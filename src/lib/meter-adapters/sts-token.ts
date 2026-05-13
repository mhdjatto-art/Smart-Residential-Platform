import type { MeterAdapter, AdapterResponse, MeterConfig } from "./types";
import { adapterError } from "./types";

/**
 * STS Token adapter (Aclara, Conlog, Itron, Hexing).
 *
 * Token-based meters are OFFLINE — they don't talk to the network. The
 * resident buys credit, the system generates a 20-digit STS-style token,
 * the resident keys it into the meter manually (or scans a card).
 *
 * For these meters there is no "fetch reading from device" loop. Instead:
 *   • generate_sts_token RPC produces a 20-digit code on top-up
 *   • prepaid_tokens row tracks the token lifecycle
 *   • a maintenance operator visits monthly and types the meter's
 *     current cumulative reading into the UI (handled by the MANUAL
 *     adapter)
 *
 * So fetchReading here always reports "manual_only — no fetch".
 */
export const stsTokenAdapter: MeterAdapter = {
  name: "STS_TOKEN",
  async fetchReading(_meter: MeterConfig, _secret: string | null): Promise<AdapterResponse> {
    return adapterError(
      "STS token meters are offline — no fetch possible. Use MANUAL adapter for the periodic reading.",
      false,
    );
  },
};
