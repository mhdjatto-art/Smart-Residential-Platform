/**
 * Meter adapter framework — shared types.
 *
 * Every adapter implementation (HTTP, MQTT, Modbus, STS, Manual) talks to a
 * specific vendor / protocol and translates the response into a normalized
 * `MeterReading` that the sync worker writes through the SQL RPCs.
 *
 * The worker handles the database side (sync_jobs, sync_job_logs,
 * utility_meter_readings, wallet_deductions, cutoff/restore). Adapters
 * stay focused on protocol-specific concerns.
 */

export interface MeterConfig {
  meter_id: string;
  organization_id: string;
  compound_id: string;
  utility_type: "electricity" | "water" | "gas" | "internet" | "maintenance" | "generator" | "other";
  api_provider: string | null;
  external_meter_id: string | null;
  reading_unit: string | null;
  /** Raw adapter config (URL, host, port, credential pointer …). */
  adapter_config: Record<string, unknown>;
  /** Reference into provider_credentials — never the secret itself. */
  vault_key?: string | null;
  env_var_name?: string | null;
}

export interface MeterReading {
  /** Cumulative meter value (e.g. 1234.567 kWh). */
  reading_value: number;
  /** Reading unit — defaults to the meter's reading_unit if omitted. */
  reading_unit?: string;
  /** Source timestamp (defaults to "now" if the device doesn't supply one). */
  reading_at?: Date;
  /** Provider-side identifier for dedup (request id, message id, etc.). */
  external_reading_id?: string;
  /** Untouched payload from the device — stored for forensic debugging. */
  raw_payload?: Record<string, unknown>;
}

export interface AdapterFetchResult {
  ok: true;
  reading: MeterReading;
  /** Optional human-readable description for the sync log. */
  detail?: string;
}

export interface AdapterError {
  ok: false;
  error: string;
  retryable: boolean;
  http_status?: number;
}

export type AdapterResponse = AdapterFetchResult | AdapterError;

/** Every adapter implements this minimal interface. */
export interface MeterAdapter {
  /** Stable name — must match electricity_meters.api_provider values. */
  readonly name: string;
  /** Pull a single reading. The worker handles persistence. */
  fetchReading(meter: MeterConfig, secret: string | null): Promise<AdapterResponse>;
  /** Optional disconnect / suspend command (e.g. Mikrotik PPPoE disable). */
  disconnect?(meter: MeterConfig, secret: string | null): Promise<AdapterResponse>;
  /** Optional reconnect command after top-up. */
  reconnect?(meter: MeterConfig, secret: string | null): Promise<AdapterResponse>;
  /** Optional health-check (used by the integrations page badge). */
  healthcheck?(meter: MeterConfig, secret: string | null): Promise<AdapterResponse>;
}

/**
 * Adapter resolution — every meter row has an `api_provider` text column.
 * The registry maps that value to an implementation.
 *
 * Known values (extend the registry to add new ones):
 *   • HTTP_REST      — generic JSON over HTTPS
 *   • MQTT           — subscribe to a topic per meter
 *   • MODBUS_TCP     — RS-485 → TCP gateway
 *   • STS_TOKEN      — 20-digit prepaid tokens (Aclara, Conlog, Itron)
 *   • HEXING         — Hexing-specific STS variant
 *   • ITRON_TOKEN    — Itron-specific STS variant
 *   • MANUAL         — operator types the reading via the UI
 *   • CSV_IMPORT     — bulk upload from provider's CSV
 *   • MIKROTIK       — RouterOS API (internet metering)
 *   • TR069          — CWMP (broadband CPE)
 */
export type AdapterName =
  | "HTTP_REST"
  | "MQTT"
  | "MODBUS_TCP"
  | "STS_TOKEN"
  | "HEXING"
  | "ITRON_TOKEN"
  | "MANUAL"
  | "CSV_IMPORT"
  | "MIKROTIK"
  | "TR069";

/** Tiny structured-error helper so log rows have consistent shape. */
export function adapterError(error: string, retryable = true, http_status?: number): AdapterError {
  return { ok: false, error, retryable, http_status };
}

/** Read a credential by looking up Vault key or env var name. */
export async function resolveSecret(meter: MeterConfig): Promise<string | null> {
  // Production: pull from Supabase Vault here.
  // For now, fall through to env var lookup (per-meter or per-integration).
  if (meter.env_var_name) {
    return process.env[meter.env_var_name] ?? null;
  }
  return null;
}
