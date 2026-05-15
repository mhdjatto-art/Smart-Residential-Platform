/**
 * Phase 17 — Feature flag enforcement layer.
 *
 * Loads the effective set of enabled features for an organization. Each
 * feature_key resolves in this order:
 *   1. Org-specific row (if exists)
 *   2. Global row (organization_id IS NULL)
 *   3. Default: true
 *
 * The Master Permissions Center writes to `feature_flags`; this module reads
 * those writes and powers UI gating in the sidebar, nav, and route guards.
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type FeatureKey =
  | "wallets" | "marketplace" | "parking" | "visitors" | "facilities"
  | "tickets" | "utilities" | "meters"   | "contracts" | "documents"
  | "announcements" | "audit_log" | "iot" | "erp_integration" | "mobile_apps";

interface FlagRow {
  organization_id: string | null;
  feature_key:     string;
  enabled:         boolean;
}

/**
 * Resolve all feature flags for an org. Returns a Set of *enabled* feature keys
 * so callers can do `enabled.has("marketplace")`.
 *
 * Org-specific rows override global rows. Missing keys default to enabled.
 * This function is cheap (one DB round-trip) and should be called once per
 * request at the layout level.
 */
export async function getEnabledFeatures(orgId: string | null): Promise<Set<string>> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("feature_flags")
    .select("organization_id, feature_key, enabled");

  if (error || !data) {
    // On error, fail-open — enable everything (default behaviour)
    return new Set<string>();
  }

  // Group by feature_key; org-specific wins.
  const byKey = new Map<string, FlagRow>();
  for (const row of data as FlagRow[]) {
    const existing = byKey.get(row.feature_key);
    if (!existing) {
      byKey.set(row.feature_key, row);
      continue;
    }
    // Prefer org-specific over global
    if (row.organization_id === orgId && existing.organization_id === null) {
      byKey.set(row.feature_key, row);
    }
  }

  const enabled = new Set<string>();
  for (const [key, row] of byKey) {
    if (row.enabled) enabled.add(key);
  }
  return enabled;
}

/**
 * Returns true if a feature is enabled for the given org, with default = true.
 * Use inside server components/actions when only a single flag is needed.
 */
export async function isFeatureEnabled(orgId: string | null, featureKey: FeatureKey): Promise<boolean> {
  const enabled = await getEnabledFeatures(orgId);
  // Default = enabled if no rows exist at all (fail-open by design).
  return enabled.size === 0 ? true : enabled.has(featureKey);
}
