"use server";

/**
 * ERP push worker.
 *
 * Picks every `journal_entries` row with status='queued' (limited per run),
 * resolves its erp_integration, dispatches the JE via the matching adapter,
 * and updates the row + writes a row in erp_sync_log.
 *
 * Designed to be:
 *   • Idempotent — re-running on a 'syncing' row that already posted updates
 *     to 'posted' instead of pushing again (uses external_journal_id check).
 *   • Best-effort — one failed entry doesn't stop the rest.
 *   • Backoff-friendly — increments retry_count and stamps failed_at.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { makeAdapter, type JournalEntryDTO, type ErpAdapter } from "@/lib/erp/adapters";

export interface PushRunSummary {
  picked: number;
  posted: number;
  failed: number;
  skipped: number;
  details: Array<{
    entry_id: string;
    entry_number: string;
    outcome: "posted" | "failed" | "skipped";
    external_id?: string;
    error?: string;
    duration_ms?: number;
  }>;
}

const MAX_PER_RUN = 20;
const MAX_RETRY = 5;

export async function pushQueuedJournalEntries(): Promise<PushRunSummary> {
  const admin = createAdminClient();
  const summary: PushRunSummary = { picked: 0, posted: 0, failed: 0, skipped: 0, details: [] };

  // 1. Pick queued entries (oldest first)
  const { data: queued, error: qErr } = await admin
    .from("journal_entries")
    .select("id, organization_id, integration_id, entry_number, entry_date, reference, description, currency, total_amount, source_table, retry_count, external_journal_id, status")
    .eq("status", "queued")
    .order("created_at")
    .limit(MAX_PER_RUN);
  if (qErr) {
    console.error("[erp-worker] failed to list queued:", qErr.message);
    return summary;
  }

  type Entry = {
    id: string; organization_id: string; integration_id: string | null;
    entry_number: string; entry_date: string; reference: string | null; description: string | null;
    currency: string; total_amount: number; source_table: string | null;
    retry_count: number; external_journal_id: string | null; status: string;
  };
  const entries = (queued ?? []) as Entry[];
  summary.picked = entries.length;
  if (entries.length === 0) return summary;

  // 2. Pre-fetch the integrations + lines for each entry (batched)
  const integrationIds = Array.from(new Set(entries.map((e) => e.integration_id).filter(Boolean) as string[]));
  const entryIds = entries.map((e) => e.id);

  const [intRes, lineRes] = await Promise.all([
    admin.from("erp_integrations").select("id, kind, base_url, database_name, username, credentials_ref, company_external_id, default_currency, config").in("id", integrationIds.length > 0 ? integrationIds : ["00000000-0000-0000-0000-000000000000"]),
    admin.from("journal_lines").select("entry_id, account_external_id, account_code, debit, credit, description, partner_external_id, line_number").in("entry_id", entryIds).order("line_number"),
  ]);

  type IntegrationRow = {
    id: string; kind: string;
    base_url: string | null; database_name: string | null; username: string | null;
    credentials_ref: string | null; company_external_id: string | null;
    default_currency: string | null;
    config: Record<string, unknown>;
  };
  type LineRow = {
    entry_id: string; account_external_id: string; account_code: string | null;
    debit: number; credit: number; description: string | null; partner_external_id: string | null;
    line_number: number;
  };

  const integrationsById = new Map<string, IntegrationRow>();
  for (const i of ((intRes.data ?? []) as unknown as IntegrationRow[])) integrationsById.set(i.id, i);

  const linesByEntry = new Map<string, LineRow[]>();
  for (const l of ((lineRes.data ?? []) as unknown as LineRow[])) {
    const arr = linesByEntry.get(l.entry_id) ?? [];
    arr.push(l);
    linesByEntry.set(l.entry_id, arr);
  }

  // 3. Process each entry
  for (const entry of entries) {
    const startedAt = Date.now();

    if (!entry.integration_id) {
      await markFailed(admin, entry.id, "No integration_id set on the journal entry");
      summary.failed++;
      summary.details.push({ entry_id: entry.id, entry_number: entry.entry_number, outcome: "failed", error: "missing integration" });
      continue;
    }
    if (entry.retry_count >= MAX_RETRY) {
      summary.skipped++;
      summary.details.push({ entry_id: entry.id, entry_number: entry.entry_number, outcome: "skipped", error: `Max retries (${MAX_RETRY}) exceeded` });
      continue;
    }
    if (entry.external_journal_id) {
      // Already posted upstream — just flip status.
      await admin.from("journal_entries").update({ status: "posted", posted_at: new Date().toISOString() }).eq("id", entry.id);
      summary.skipped++;
      summary.details.push({ entry_id: entry.id, entry_number: entry.entry_number, outcome: "skipped", external_id: entry.external_journal_id, error: "Already had external_journal_id" });
      continue;
    }

    const integration = integrationsById.get(entry.integration_id);
    if (!integration) {
      await markFailed(admin, entry.id, "Integration not found");
      summary.failed++;
      summary.details.push({ entry_id: entry.id, entry_number: entry.entry_number, outcome: "failed", error: "integration not found" });
      continue;
    }

    // Mark as syncing (best-effort)
    await admin.from("journal_entries").update({ status: "syncing" }).eq("id", entry.id);

    // Build the DTO
    const lines = (linesByEntry.get(entry.id) ?? []).map((l) => ({
      account_external_id: l.account_external_id,
      account_code: l.account_code ?? undefined,
      debit: Number(l.debit),
      credit: Number(l.credit),
      description: l.description ?? undefined,
      partner_external_id: l.partner_external_id ?? undefined,
    }));

    const dto: JournalEntryDTO = {
      entry_id: entry.id,
      entry_number: entry.entry_number,
      entry_date: entry.entry_date,
      reference: entry.reference,
      description: entry.description,
      currency: entry.currency,
      total_amount: Number(entry.total_amount),
      source_table: entry.source_table,
      lines,
    };

    // Build the adapter
    let adapter: ErpAdapter;
    try {
      adapter = makeAdapter(integration.kind as ErpAdapter["kind"], {
        base_url: integration.base_url,
        database_name: integration.database_name,
        username: integration.username,
        api_key: integration.credentials_ref, // production should resolve via vault; here we use ref directly
        company_external_id: integration.company_external_id,
        default_currency: integration.default_currency ?? "IQD",
        extra: integration.config,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "adapter init failed";
      await markFailed(admin, entry.id, msg);
      summary.failed++;
      summary.details.push({ entry_id: entry.id, entry_number: entry.entry_number, outcome: "failed", error: msg });
      continue;
    }

    // PUSH
    const result = await adapter.pushJournalEntry(dto);
    const duration = Date.now() - startedAt;

    // Log to erp_sync_log
    await admin.from("erp_sync_log").insert({
      organization_id: entry.organization_id,
      integration_id:  entry.integration_id,
      entry_id:        entry.id,
      action:          "push_entry",
      outcome:         result.success ? "success" : "failure",
      http_status:     result.http_status ?? null,
      duration_ms:     result.duration_ms ?? duration,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- object not assignable to Json
      response_payload: result.response as any,
      error_message:   result.error ?? null,
      external_id_returned: result.external_id ?? null,
    });

    if (result.success) {
      await admin.from("journal_entries").update({
        status:               "posted",
        external_journal_id:  result.external_id ?? null,
        posted_at:            new Date().toISOString(),
        failed_at:            null,
      }).eq("id", entry.id);
      summary.posted++;
      summary.details.push({ entry_id: entry.id, entry_number: entry.entry_number, outcome: "posted", external_id: result.external_id, duration_ms: duration });
    } else {
      await admin.from("journal_entries").update({
        status:       entry.retry_count + 1 >= MAX_RETRY ? "failed" : "queued",
        failed_at:    new Date().toISOString(),
        retry_count:  entry.retry_count + 1,
      }).eq("id", entry.id);
      summary.failed++;
      summary.details.push({ entry_id: entry.id, entry_number: entry.entry_number, outcome: "failed", error: result.error, duration_ms: duration });
    }
  }

  return summary;
}

async function markFailed(admin: ReturnType<typeof createAdminClient>, entryId: string, error: string): Promise<void> {
  await admin.from("journal_entries").update({
    status:    "failed",
    failed_at: new Date().toISOString(),
  }).eq("id", entryId);
  // Also log
  await admin.from("erp_sync_log").insert({
    entry_id: entryId,
    action: "push_entry",
    outcome: "failure",
    error_message: error,
  });
}
