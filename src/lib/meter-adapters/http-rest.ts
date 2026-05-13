import type {
  AdapterResponse, MeterAdapter, MeterConfig,
} from "./types";
import { adapterError } from "./types";

/**
 * Generic HTTP REST adapter.
 *
 * Reads a meter via an HTTPS endpoint that returns JSON. Config schema in
 * `electricity_meters.adapter_config` (jsonb):
 *
 *   {
 *     "endpoint": "https://api.provider.com/v1/meters/{external_id}/reading",
 *     "method":   "GET",                                // default GET
 *     "auth":     "bearer" | "basic" | "apikey" | "none",
 *     "apikey_header": "X-API-Key",                      // when auth=apikey
 *     "value_path":  "data.cumulative_kwh",              // dot-path to the reading
 *     "unit_path":   "data.unit",                        // optional
 *     "timestamp_path": "data.timestamp",                // optional ISO-8601
 *     "extra_headers": { "Accept": "application/json" } // optional
 *   }
 *
 * Variable substitution in `endpoint`:
 *   {external_id} → meter.external_meter_id
 *   {meter_id}    → meter.meter_id
 */
export const httpRestAdapter: MeterAdapter = {
  name: "HTTP_REST",

  async fetchReading(meter: MeterConfig, secret: string | null): Promise<AdapterResponse> {
    const cfg = meter.adapter_config as {
      endpoint?: string;
      method?: "GET" | "POST";
      auth?: "bearer" | "basic" | "apikey" | "none";
      apikey_header?: string;
      value_path?: string;
      unit_path?: string;
      timestamp_path?: string;
      extra_headers?: Record<string, string>;
      timeout_ms?: number;
    };

    if (!cfg?.endpoint) return adapterError("adapter_config.endpoint is required", false);
    if (!cfg.value_path) return adapterError("adapter_config.value_path is required", false);

    const url = cfg.endpoint
      .replace("{external_id}", encodeURIComponent(meter.external_meter_id ?? ""))
      .replace("{meter_id}", encodeURIComponent(meter.meter_id));

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(cfg.extra_headers ?? {}),
    };
    if (cfg.auth === "bearer" && secret) headers.Authorization = `Bearer ${secret}`;
    if (cfg.auth === "basic"  && secret) headers.Authorization = `Basic ${Buffer.from(secret).toString("base64")}`;
    if (cfg.auth === "apikey" && secret) headers[cfg.apikey_header ?? "X-API-Key"] = secret;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.timeout_ms ?? 10_000);

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: cfg.method ?? "GET",
        headers,
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (e) {
      clearTimeout(timeout);
      const err = e instanceof Error ? e.message : "Network error";
      return adapterError(`fetch failed: ${err}`, true);
    }
    clearTimeout(timeout);

    if (!resp.ok) {
      return adapterError(`HTTP ${resp.status} ${resp.statusText}`, resp.status >= 500, resp.status);
    }

    let body: unknown;
    try {
      body = await resp.json();
    } catch (e) {
      const err = e instanceof Error ? e.message : "Bad JSON";
      return adapterError(`JSON parse failed: ${err}`, false);
    }

    const value = readPath(body, cfg.value_path);
    if (value === undefined || value === null) {
      return adapterError(`value_path '${cfg.value_path}' not found in response`, false);
    }
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      return adapterError(`value at '${cfg.value_path}' is not numeric: ${String(value).slice(0, 80)}`, false);
    }

    const unit = cfg.unit_path ? String(readPath(body, cfg.unit_path) ?? meter.reading_unit ?? "kWh") : (meter.reading_unit ?? "kWh");
    const ts   = cfg.timestamp_path ? readPath(body, cfg.timestamp_path) : null;
    const readingAt = ts ? new Date(String(ts)) : new Date();

    return {
      ok: true,
      reading: {
        reading_value: numeric,
        reading_unit: unit,
        reading_at: isNaN(readingAt.getTime()) ? new Date() : readingAt,
        raw_payload: body as Record<string, unknown>,
      },
      detail: `HTTP ${resp.status} from ${new URL(url).host}`,
    };
  },
};

/** Walks an object via a dot-separated path. Returns undefined on miss. */
function readPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}
