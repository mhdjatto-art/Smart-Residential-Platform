import type { MeterAdapter, AdapterResponse, MeterConfig } from "./types";
import { adapterError } from "./types";

/**
 * MIKROTIK adapter — internet meter via RouterOS REST API.
 *
 * RouterOS 7.x exposes a REST API at https://router/rest. We pull the
 * PPPoE/Hotspot active-session bytes and use them as the "reading" — every
 * sync, the worker computes (current - last) and deducts from the wallet.
 *
 * disconnect() disables the PPPoE secret to cut off internet.
 * reconnect() re-enables it after the wallet is topped up.
 *
 * Config schema (electricity_meters.adapter_config):
 *   {
 *     "endpoint":      "https://router.compound.local/rest",
 *     "username_path": "/ppp/secret",
 *     "username":      "{external_id}"          // PPPoE login of the unit
 *   }
 *
 * Credential: stored in `vault_key` or env_var_name as
 *   "router_user:router_password"  (basic auth)
 *
 * Bandwidth bytes → IQD conversion is set on the subscription's
 * monthly_fee + a per-GB rate in the integration config.
 */
export const mikrotikAdapter: MeterAdapter = {
  name: "MIKROTIK",

  async fetchReading(meter: MeterConfig, secret: string | null): Promise<AdapterResponse> {
    const cfg = meter.adapter_config as { endpoint?: string; username?: string };
    if (!cfg?.endpoint || !cfg.username) return adapterError("adapter_config.endpoint and .username required", false);
    if (!secret || !secret.includes(":")) return adapterError("secret must be 'user:password'", false);

    const auth = "Basic " + Buffer.from(secret).toString("base64");
    const username = cfg.username.replace("{external_id}", meter.external_meter_id ?? "");
    const url = `${cfg.endpoint}/ppp/active?name=${encodeURIComponent(username)}`;

    let resp: Response;
    try {
      resp = await fetch(url, {
        headers: { Authorization: auth, Accept: "application/json" },
        cache: "no-store",
      });
    } catch (e) {
      return adapterError(`fetch failed: ${e instanceof Error ? e.message : "unknown"}`, true);
    }
    if (!resp.ok) return adapterError(`HTTP ${resp.status}`, resp.status >= 500, resp.status);

    const list = (await resp.json().catch(() => [])) as Array<{ "bytes-in"?: string; "bytes-out"?: string }>;
    if (!Array.isArray(list) || list.length === 0) {
      // No active session — assume zero delta this poll.
      return {
        ok: true,
        reading: { reading_value: 0, reading_unit: "GB", reading_at: new Date(), raw_payload: { sessions: 0 } },
        detail: "No active PPPoE session",
      };
    }
    const totalBytes = list.reduce(
      (sum, row) => sum + (parseInt(row["bytes-in"] ?? "0", 10) || 0) + (parseInt(row["bytes-out"] ?? "0", 10) || 0),
      0,
    );
    const gb = totalBytes / (1024 ** 3);
    return {
      ok: true,
      reading: { reading_value: Number(gb.toFixed(6)), reading_unit: "GB", reading_at: new Date(), raw_payload: { sessions: list } },
      detail: `Total ${gb.toFixed(2)} GB across ${list.length} session(s)`,
    };
  },

  async disconnect(meter: MeterConfig, secret: string | null): Promise<AdapterResponse> {
    const cfg = meter.adapter_config as { endpoint?: string; username?: string };
    if (!cfg?.endpoint || !cfg.username || !secret) return adapterError("config or secret missing", false);
    const auth = "Basic " + Buffer.from(secret).toString("base64");
    const username = cfg.username.replace("{external_id}", meter.external_meter_id ?? "");
    try {
      const r = await fetch(`${cfg.endpoint}/ppp/secret/set`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ ".id": username, disabled: "yes" }),
      });
      if (!r.ok) return adapterError(`disconnect HTTP ${r.status}`, r.status >= 500, r.status);
      return { ok: true, reading: { reading_value: 0 }, detail: "PPPoE secret disabled" };
    } catch (e) {
      return adapterError(`disconnect: ${e instanceof Error ? e.message : "unknown"}`, true);
    }
  },

  async reconnect(meter: MeterConfig, secret: string | null): Promise<AdapterResponse> {
    const cfg = meter.adapter_config as { endpoint?: string; username?: string };
    if (!cfg?.endpoint || !cfg.username || !secret) return adapterError("config or secret missing", false);
    const auth = "Basic " + Buffer.from(secret).toString("base64");
    const username = cfg.username.replace("{external_id}", meter.external_meter_id ?? "");
    try {
      const r = await fetch(`${cfg.endpoint}/ppp/secret/set`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ ".id": username, disabled: "no" }),
      });
      if (!r.ok) return adapterError(`reconnect HTTP ${r.status}`, r.status >= 500, r.status);
      return { ok: true, reading: { reading_value: 0 }, detail: "PPPoE secret enabled" };
    } catch (e) {
      return adapterError(`reconnect: ${e instanceof Error ? e.message : "unknown"}`, true);
    }
  },
};
