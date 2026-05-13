/**
 * Meter sync worker.
 *
 * Picks up to N due meters, runs each one's adapter, writes the reading
 * through sync_meter_reading_from_provider RPC, and (if the wallet is
 * prepaid) deducts consumption + cuts off at zero.
 *
 * Called by:
 *   • the meter-sync cron endpoint (every 15 min)
 *   • the manual "Sync now" button on the meter detail page
 *
 * Per-meter flow:
 *   1. Resolve the adapter from `meter.api_provider`
 *   2. Resolve the secret (Vault → env var)
 *   3. adapter.fetchReading(meter, secret)
 *   4. On success: call public.sync_meter_reading_from_provider RPC
 *      (it inserts utility_meter_readings + utility_usage_events + advances
 *       the meter's last_reading + opens/closes the sync_job).
 *   5. If a prepaid wallet exists for this meter, compute consumption
 *      delta × tariff and call deduct_for_consumption.
 *   6. If wallet balance ≤ 0 AND auto_cutoff_at_zero, call adapter.disconnect.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getAdapter } from "./registry";
import { resolveSecret, type MeterConfig } from "./types";
import { reportError } from "@/lib/observability/report";

interface MeterRow {
  id: string;
  organization_id: string;
  compound_id: string;
  unit_id: string | null;
  utility_type: string;
  api_provider: string | null;
  external_meter_id: string | null;
  reading_unit: string | null;
  current_reading: number;
  last_reading: number;
  adapter_config: Record<string, unknown> | null;
  provider_id: string | null;
}

interface WalletRow {
  id: string;
  resident_id: string;
  balance: number;
  service_state: string;
  auto_cutoff_at_zero: boolean;
}

interface TariffRow {
  rate_per_unit: number;
}

export interface SyncSummary {
  scheduled: number;
  succeeded: number;
  failed: number;
  skipped: number;
  details: Array<{
    meter_id: string;
    adapter: string;
    outcome: "succeeded" | "failed" | "skipped";
    message?: string;
    reading_value?: number;
    consumption?: number;
    deducted?: number;
    cutoff?: boolean;
  }>;
}

const MAX_BATCH = 50;

/**
 * Run a single meter through its adapter and write the result.
 * Returns the per-meter row that the caller appends to the summary.
 */
export async function syncSingleMeter(meterId: string): Promise<SyncSummary["details"][number]> {
  const admin = createAdminClient();

  const { data: meterData, error } = await admin
    .from("electricity_meters")
    .select("*")
    .eq("id", meterId)
    .maybeSingle();
  if (error || !meterData) {
    return { meter_id: meterId, adapter: "?", outcome: "failed", message: error?.message ?? "meter not found" };
  }
  const meter = meterData as unknown as MeterRow;

  const adapter = getAdapter(meter.api_provider);
  if (!adapter) {
    return { meter_id: meter.id, adapter: meter.api_provider ?? "none", outcome: "skipped", message: "no adapter registered" };
  }

  const cfg: MeterConfig = {
    meter_id: meter.id,
    organization_id: meter.organization_id,
    compound_id: meter.compound_id,
    utility_type: meter.utility_type as MeterConfig["utility_type"],
    api_provider: meter.api_provider,
    external_meter_id: meter.external_meter_id,
    reading_unit: meter.reading_unit,
    adapter_config: meter.adapter_config ?? {},
  };
  const secret = await resolveSecret(cfg);

  const result = await adapter.fetchReading(cfg, secret);
  if (!result.ok) {
    return {
      meter_id: meter.id, adapter: adapter.name, outcome: "failed",
      message: result.error,
    };
  }

  // Write through the RPC so all SRP-side invariants kick in
  const externalId = result.reading.external_reading_id
    ?? `${adapter.name}:${meter.id}:${Date.now()}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: readingId, error: rpcErr } = await (admin as any).rpc(
    "sync_meter_reading_from_provider",
    {
      p_meter_id:        meter.id,
      p_external_id:     externalId,
      p_reading_value:   result.reading.reading_value,
      p_reading_at:      (result.reading.reading_at ?? new Date()).toISOString(),
      p_integration_id:  null,
      p_raw_payload:     result.reading.raw_payload ?? {},
      p_idempotency_key: externalId,
    },
  );

  if (rpcErr) {
    return { meter_id: meter.id, adapter: adapter.name, outcome: "failed", message: `rpc: ${rpcErr.message}` };
  }

  // Compute consumption × tariff and deduct from the wallet (if prepaid)
  const consumption = Math.max(0, result.reading.reading_value - meter.last_reading);

  if (consumption > 0) {
    // Find the wallet for this meter (meter-scoped first, then resident-scoped)
    const { data: walletByMeter } = await admin
      .from("utility_wallets")
      .select("*")
      .eq("meter_id", meter.id)
      .eq("status", "active")
      .maybeSingle();
    let wallet = walletByMeter as unknown as WalletRow | null;
    if (!wallet) {
      // Resident-scoped fallback — look up the unit's assigned resident
      if (meter.unit_id) {
        const { data: ua } = await admin
          .from("unit_assignments")
          .select("resident_id")
          .eq("unit_id", meter.unit_id)
          .eq("is_current", true)
          .maybeSingle();
        const residentId = (ua as { resident_id?: string } | null)?.resident_id;
        if (residentId) {
          const { data: walletByRes } = await admin
            .from("utility_wallets")
            .select("*")
            .eq("resident_id", residentId)
            .eq("utility_type", meter.utility_type)
            .is("meter_id", null)
            .eq("status", "active")
            .maybeSingle();
          wallet = walletByRes as unknown as WalletRow | null;
        }
      }
    }

    if (wallet) {
      // Pull the active tariff to convert units → IQD
      const { data: tariff } = await admin
        .from("electricity_tariffs")
        .select("rate_per_unit")
        .eq("provider_id", meter.provider_id ?? "")
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();
      const rate = (tariff as unknown as TariffRow | null)?.rate_per_unit ?? 0;
      const cost = Number((consumption * rate).toFixed(4));

      if (cost > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: dedErr } = await (admin as any).rpc("deduct_for_consumption", {
          p_wallet_id:        wallet.id,
          p_amount:           cost,
          p_units_consumed:   consumption,
          p_unit_price:       rate,
          p_usage_event_id:   null,
          p_meter_reading_id: readingId,
          p_reason:           "consumption",
          p_notes:            `auto-deducted by ${adapter.name} adapter`,
        });
        if (dedErr) {
          reportError(new Error(dedErr.message), {
            module: "meter-worker",
            extra: { meter_id: meter.id, cost, consumption },
          });
          return { meter_id: meter.id, adapter: adapter.name, outcome: "failed", message: `deduct: ${dedErr.message}` };
        }

        // If wallet hit zero AND auto-cutoff is on, send disconnect command
        let cutoffSent = false;
        const newBalance = wallet.balance - cost;
        if (newBalance <= 0 && wallet.auto_cutoff_at_zero && wallet.service_state === "connected" && adapter.disconnect) {
          const d = await adapter.disconnect(cfg, secret);
          cutoffSent = d.ok;
          if (!d.ok) {
            reportError(new Error(d.error), { module: "meter-worker", extra: { meter_id: meter.id, action: "disconnect" } });
          }
        }

        return {
          meter_id: meter.id, adapter: adapter.name, outcome: "succeeded",
          reading_value: result.reading.reading_value,
          consumption,
          deducted: cost,
          cutoff: cutoffSent,
        };
      }
    }
  }

  return {
    meter_id: meter.id, adapter: adapter.name, outcome: "succeeded",
    reading_value: result.reading.reading_value,
    consumption,
  };
}

/**
 * Top-level worker — runs up to MAX_BATCH due meters and returns a summary.
 *
 * "Due" = active meter with a non-null api_provider that supports fetch.
 * We sort by last_sync_at NULLS FIRST so unsynced meters drain first.
 */
export async function runMeterSync(): Promise<SyncSummary> {
  const admin = createAdminClient();
  const { data: meters, error } = await admin
    .from("electricity_meters")
    .select("id, api_provider")
    .not("api_provider", "is", null)
    .eq("status", "active")
    .order("last_sync_at", { ascending: true })
    .limit(MAX_BATCH);

  if (error) {
    return {
      scheduled: 0, succeeded: 0, failed: 1, skipped: 0,
      details: [{ meter_id: "?", adapter: "?", outcome: "failed", message: error.message }],
    };
  }

  const rows = (meters ?? []) as Array<{ id: string; api_provider: string | null }>;
  const summary: SyncSummary = { scheduled: rows.length, succeeded: 0, failed: 0, skipped: 0, details: [] };

  for (const m of rows) {
    try {
      const res = await syncSingleMeter(m.id);
      summary.details.push(res);
      if (res.outcome === "succeeded") summary.succeeded++;
      else if (res.outcome === "failed") summary.failed++;
      else summary.skipped++;
    } catch (e) {
      summary.failed++;
      summary.details.push({ meter_id: m.id, adapter: m.api_provider ?? "?", outcome: "failed", message: e instanceof Error ? e.message : "unknown" });
    }
  }

  return summary;
}
