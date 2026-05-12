import "server-only";

/**
 * SRP ERP Bridge — Adapter contract.
 *
 * Each adapter translates an internal SRP journal entry into whatever shape
 * the customer's accounting system expects (Odoo, SAP, plain CSV, …).
 *
 * Workers (Edge Functions / Vercel cron) pick `erp:push_journal_entry` jobs
 * off the job_queue, resolve the integration, instantiate the right adapter,
 * call `pushJournalEntry`, and write back via `log_erp_sync`.
 *
 * Note: this module is server-only — never import it from a client component.
 */

export interface JournalLineDTO {
  account_external_id: string;
  account_code?: string;
  debit: number;
  credit: number;
  description?: string;
  partner_external_id?: string;
}

export interface JournalEntryDTO {
  entry_id: string;
  entry_number: string;
  entry_date: string;
  reference: string | null;
  description: string | null;
  currency: string;
  total_amount: number;
  source_table: string | null;
  lines: JournalLineDTO[];
}

export interface PushResult {
  success: boolean;
  external_id?: string;
  http_status?: number;
  duration_ms: number;
  response?: unknown;
  error?: string;
}

export interface ErpAdapter {
  kind: "odoo" | "sap" | "csv" | "custom" | "generic" | "sage" | "quickbooks" | "xero";
  pushJournalEntry(entry: JournalEntryDTO): Promise<PushResult>;
  testConnection(): Promise<PushResult>;
  pullAccounts?(): Promise<{ accounts: { external_id: string; code: string; name: string; type?: string }[] }>;
}

interface AdapterConfig {
  base_url?: string | null;
  database_name?: string | null;
  username?: string | null;
  api_key?: string | null;        // resolved from credentials_ref by the worker
  company_external_id?: string | null;
  default_currency?: string;
  csv_export_path?: string | null;
  extra?: Record<string, unknown>;
}

// ─── Odoo ───────────────────────────────────────────────────────────────
// Uses Odoo's JSON-RPC interface (`/jsonrpc`).
//
// Step 1 — call `authenticate` to get a uid.
// Step 2 — call `execute_kw` with model='account.move' to create the entry.
//
// For brevity this implementation skips OdooBot session caching; real workers
// should cache the uid for ~30 min.

export class OdooAdapter implements ErpAdapter {
  kind = "odoo" as const;
  constructor(private cfg: AdapterConfig) {}

  private async rpc(service: string, method: string, args: unknown[]): Promise<unknown> {
    if (!this.cfg.base_url) throw new Error("Odoo base_url not configured");
    const res = await fetch(`${this.cfg.base_url}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: { service, method, args },
      }),
    });
    if (!res.ok) throw new Error(`Odoo HTTP ${res.status}: ${await res.text()}`);
    const body = await res.json() as { result?: unknown; error?: { message?: string; data?: { message?: string } } };
    if (body.error) throw new Error(body.error.data?.message ?? body.error.message ?? "Odoo RPC error");
    return body.result;
  }

  private async authenticate(): Promise<number> {
    const uid = await this.rpc("common", "login", [
      this.cfg.database_name, this.cfg.username, this.cfg.api_key,
    ]);
    if (typeof uid !== "number" || uid <= 0) throw new Error("Odoo authentication failed");
    return uid;
  }

  async testConnection(): Promise<PushResult> {
    const t0 = Date.now();
    try {
      await this.authenticate();
      return { success: true, duration_ms: Date.now() - t0 };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e), duration_ms: Date.now() - t0 };
    }
  }

  async pushJournalEntry(entry: JournalEntryDTO): Promise<PushResult> {
    const t0 = Date.now();
    try {
      const uid = await this.authenticate();
      const lines = entry.lines.map((l) => [
        0, 0, {
          account_id: Number(l.account_external_id),
          debit: l.debit,
          credit: l.credit,
          name: l.description ?? entry.reference ?? entry.entry_number,
        },
      ]);
      const created = await this.rpc("object", "execute_kw", [
        this.cfg.database_name, uid, this.cfg.api_key,
        "account.move", "create", [{
          ref: entry.reference ?? entry.entry_number,
          date: entry.entry_date,
          company_id: this.cfg.company_external_id ? Number(this.cfg.company_external_id) : undefined,
          line_ids: lines,
        }],
      ]);
      const externalId = typeof created === "number" ? String(created) : String((created as number[])[0] ?? "");
      return { success: true, external_id: externalId, duration_ms: Date.now() - t0 };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e), duration_ms: Date.now() - t0 };
    }
  }
}

// ─── SAP ─────────────────────────────────────────────────────────────────
// Minimal stub — production SAP integrations typically post IDocs via PI/PO
// or call OData (S/4HANA). We emit OData JSON here.

export class SapAdapter implements ErpAdapter {
  kind = "sap" as const;
  constructor(private cfg: AdapterConfig) {}

  async testConnection(): Promise<PushResult> {
    if (!this.cfg.base_url) return { success: false, error: "SAP base_url not configured", duration_ms: 0 };
    const t0 = Date.now();
    try {
      const res = await fetch(`${this.cfg.base_url}/sap/opu/odata4/sap/api_journalentry/srvd_a2x/sap/journalentry/0001/`, {
        headers: { "Authorization": `Bearer ${this.cfg.api_key}`, "Accept": "application/json" },
      });
      return { success: res.ok, http_status: res.status, duration_ms: Date.now() - t0,
               error: res.ok ? undefined : `SAP HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e), duration_ms: Date.now() - t0 };
    }
  }

  async pushJournalEntry(entry: JournalEntryDTO): Promise<PushResult> {
    const t0 = Date.now();
    if (!this.cfg.base_url) return { success: false, error: "SAP base_url not configured", duration_ms: 0 };
    try {
      const payload = {
        CompanyCode: this.cfg.company_external_id,
        DocumentDate: entry.entry_date,
        PostingDate: entry.entry_date,
        TransactionCurrency: entry.currency,
        DocumentReferenceID: entry.reference,
        DocumentHeaderText: (entry.description ?? "").slice(0, 25),
        to_Item: entry.lines.map((l, i) => ({
          ItemNumber: String(i + 1).padStart(3, "0"),
          GLAccount: l.account_external_id,
          AmountInTransactionCurrency: l.credit > 0 ? -l.credit : l.debit,
          DocumentItemText: (l.description ?? "").slice(0, 50),
        })),
      };
      const res = await fetch(`${this.cfg.base_url}/sap/opu/odata4/sap/api_journalentry/srvd_a2x/sap/journalentry/0001/A_JournalEntry`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.cfg.api_key}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, http_status: res.status, error: (data as { error?: { message?: string } }).error?.message ?? `SAP HTTP ${res.status}`, duration_ms: Date.now() - t0 };
      }
      return { success: true, http_status: res.status, external_id: String((data as { AccountingDocument?: string }).AccountingDocument ?? ""), response: data, duration_ms: Date.now() - t0 };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e), duration_ms: Date.now() - t0 };
    }
  }
}

// ─── CSV ─────────────────────────────────────────────────────────────────
// Emits a CSV string the customer can drop into ANY accounting system that
// supports import. The "external_id" is the SRP entry_number — the customer
// links them manually after import.

export class CsvAdapter implements ErpAdapter {
  kind = "csv" as const;
  constructor(private cfg: AdapterConfig) {}

  async testConnection(): Promise<PushResult> {
    return { success: true, duration_ms: 0 };
  }

  async pushJournalEntry(entry: JournalEntryDTO): Promise<PushResult> {
    const t0 = Date.now();
    const rows = [
      ["entry_number","entry_date","reference","description","account_external_id","account_code","debit","credit","currency","line_description"].join(","),
      ...entry.lines.map((l) => [
        entry.entry_number, entry.entry_date,
        csv(entry.reference ?? ""), csv(entry.description ?? ""),
        l.account_external_id, csv(l.account_code ?? ""),
        l.debit.toFixed(2), l.credit.toFixed(2),
        entry.currency, csv(l.description ?? ""),
      ].join(",")),
    ];
    const csvBody = rows.join("\n");
    // Worker should upload `csvBody` to Supabase Storage at
    // `${cfg.csv_export_path}/${entry.entry_number}.csv`. We return the
    // entry_number as the external_id so logging stays meaningful.
    return {
      success: true,
      external_id: entry.entry_number,
      duration_ms: Date.now() - t0,
      response: { csv_body: csvBody, path: `${this.cfg.csv_export_path ?? "exports/journal"}/${entry.entry_number}.csv` },
    };
  }
}

function csv(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ─── Factory ─────────────────────────────────────────────────────────────

export function makeAdapter(kind: ErpAdapter["kind"], cfg: AdapterConfig): ErpAdapter {
  switch (kind) {
    case "odoo": return new OdooAdapter(cfg);
    case "sap":  return new SapAdapter(cfg);
    case "csv":  return new CsvAdapter(cfg);
    // 'sage' / 'quickbooks' / 'xero' / 'custom' / 'generic' fall through to CSV
    // as a sensible default — replace with real adapters as needed.
    default:     return new CsvAdapter(cfg);
  }
}
