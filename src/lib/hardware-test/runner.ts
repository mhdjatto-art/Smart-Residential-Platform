/**
 * Hardware test runner — entry point.
 *
 * Resolves a provider's `adapter_kind` + `adapter_config` to the right
 * tester and returns the normalized result.
 */
import "server-only";
import type { AdapterKind, AdapterTestConfig, HardwareTestResult } from "./types";
import {
  testREST, testMikroTik, testUniFi, testModbus,
  testMQTT, testRADIUS, testWebhook, testGeneric,
} from "./testers";

const TESTERS: Record<AdapterKind, (c: AdapterTestConfig) => Promise<HardwareTestResult>> = {
  rest:     testREST,
  modbus:   testModbus,
  mqtt:     testMQTT,
  mikrotik: testMikroTik,
  unifi:    testUniFi,
  radius:   testRADIUS,
  webhook:  testWebhook,
  generic:  testGeneric,
};

export async function runHardwareTest(
  kind:   AdapterKind,
  config: AdapterTestConfig,
): Promise<HardwareTestResult> {
  const tester = TESTERS[kind];
  if (!tester) {
    return {
      outcome: "misconfigured",
      message: `Unknown adapter kind: ${kind}`,
    };
  }
  try {
    return await tester(config);
  } catch (e) {
    return {
      outcome: "unreachable",
      message: "Unexpected error during test.",
      error:   e instanceof Error ? e.message : String(e),
    };
  }
}

/** Build an AdapterTestConfig from the provider row + integration row. */
export function buildConfigFromProvider(p: {
  adapter_config?: Record<string, unknown> | null;
}, integration?: {
  config_json?: Record<string, unknown> | null;
}): AdapterTestConfig {
  // Provider has the canonical endpoint; integration may overlay credentials.
  const merged = { ...(p.adapter_config ?? {}), ...(integration?.config_json ?? {}) };
  return {
    endpoint:  typeof merged.endpoint === "string" ? merged.endpoint : (typeof merged.host === "string" ? merged.host : undefined),
    apiKey:    typeof merged.apiKey === "string" ? merged.apiKey : (typeof merged.api_key === "string" ? merged.api_key : undefined),
    username:  typeof merged.username === "string" ? merged.username : undefined,
    password:  typeof merged.password === "string" ? merged.password : undefined,
    unitId:    typeof merged.unit_id === "number" ? merged.unit_id : undefined,
    topic:     typeof merged.topic === "string" ? merged.topic : (typeof merged.topic_prefix === "string" ? merged.topic_prefix : undefined),
    extras:    merged,
  };
}
