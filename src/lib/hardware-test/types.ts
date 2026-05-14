/**
 * Hardware test runner — types.
 *
 * The test runner asks each adapter "are you reachable + responding correctly?"
 * without making any state-changing calls. Used by the /hardware-test admin
 * page to verify a provider's configuration before going live.
 *
 * Every adapter implements the same `runTest` contract:
 *
 *   1. Read its config from `provider_integrations.config_json`.
 *   2. Make a SAFE round-trip call (ping/whoami/getStatus).
 *   3. Return one of three outcomes:
 *      • "connected"   — got a 2xx + plausible response shape
 *      • "unreachable" — couldn't reach the host (DNS, connection refused, timeout)
 *      • "auth_failed" — reached the host but credentials rejected
 *      • "simulated"   — adapter is offline-only (e.g. "generic", "manual")
 *                        we surface the config back so the admin can verify it
 */

export type TestOutcome =
  | "connected"
  | "unreachable"
  | "auth_failed"
  | "simulated"
  | "misconfigured";

export interface HardwareTestResult {
  outcome:        TestOutcome;
  /** Human-readable summary shown in the UI. */
  message:        string;
  /** Latency in ms (when reachable). */
  latencyMs?:     number;
  /** Any extra detail the adapter wants to surface (firmware version, etc.). */
  details?:       Record<string, unknown>;
  /** Underlying error message when outcome is unreachable/auth_failed. */
  error?:         string;
}

export interface AdapterTestConfig {
  /** Endpoint string from utility_providers.adapter_config */
  endpoint?:   string;
  /** Optional API key / bearer token / RADIUS shared secret */
  apiKey?:     string;
  /** Optional username for RouterOS / RADIUS / Modbus auth */
  username?:   string;
  /** Optional password */
  password?:   string;
  /** Optional Modbus unit ID */
  unitId?:     number;
  /** Optional MQTT topic prefix */
  topic?:      string;
  /** Free-form additional configuration */
  extras?:     Record<string, unknown>;
}

export type AdapterKind =
  | "rest"
  | "modbus"
  | "mqtt"
  | "mikrotik"
  | "unifi"
  | "radius"
  | "webhook"
  | "generic";

export interface AdapterTester {
  readonly kind: AdapterKind;
  test(config: AdapterTestConfig): Promise<HardwareTestResult>;
}
