import type { MeterAdapter, AdapterResponse, MeterConfig } from "./types";
import { adapterError } from "./types";

/**
 * MQTT adapter — STUB.
 *
 * Real implementation requires a persistent MQTT subscriber outside the
 * serverless Vercel runtime (Vercel functions can't hold a long-lived
 * TCP connection). Recommended architecture:
 *
 *   1. Deploy a small Node worker on Railway / Fly.io / Cloudflare Worker
 *      with the `mqtt` npm package.
 *   2. The worker subscribes to topic `srp/{org}/meters/{external_id}/reading`.
 *   3. On each message it calls supabase.rpc('sync_meter_reading_from_provider')
 *      with the parsed value. The RPC handles all the SRP-side logic.
 *
 * This stub exists so the registry resolves cleanly. Calling fetchReading
 * returns an error explaining the architecture requirement.
 *
 * Config schema (when implemented):
 *   {
 *     "broker_host": "mqtt.provider.com",
 *     "broker_port": 8883,
 *     "topic":       "srp/{org}/meters/{external_id}/reading",
 *     "value_path":  "payload.kwh",
 *     "qos":         1
 *   }
 */
export const mqttAdapter: MeterAdapter = {
  name: "MQTT",
  async fetchReading(_meter: MeterConfig, _secret: string | null): Promise<AdapterResponse> {
    return adapterError(
      "MQTT requires a persistent subscriber worker. See src/lib/meter-adapters/mqtt.ts for architecture notes.",
      false,
    );
  },
};
