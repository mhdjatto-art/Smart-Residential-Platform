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
  updated_at?:     string;
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
  try {
    const supabase = await createClient();
    // Phase 17 FINAL FIX: residents are blocked by RLS from reading
    // feature_flags directly (returns empty array, no error). Use the
    // SECURITY DEFINER RPC that exposes feature_key + enabled (no
    // sensitive fields) to ALL authenticated users.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("list_feature_flags_public", {
      p_org_id: orgId,
    });

    if (error) {
      console.error("[feature-flags] read failed:", error.message ?? error);
      return new Set<string>(); // fail-open
    }
    if (!Array.isArray(data) || data.length === 0) {
      return new Set<string>(); // no rows yet → default-open via size check upstream
    }

    // Resolution policy: per feature_key, pick the BEST row in this order:
    //   1. Org-specific (organization_id === orgId), most recently updated
    //   2. Global (organization_id IS NULL), most recently updated
    // Since data is ordered by updated_at DESC, the first encountered global row
    // for each key is the most recent — and an org-specific row should replace it.
    const byKey = new Map<string, FlagRow>();
    for (const row of data as FlagRow[]) {
      if (!row || typeof row.feature_key !== "string") continue;
      const existing = byKey.get(row.feature_key);

      // Always prefer org-specific over global, regardless of existing state.
      if (orgId !== null && row.organization_id === orgId) {
        // Replace if existing was global, or this is more recent org-specific row
        if (!existing || existing.organization_id === null) {
          byKey.set(row.feature_key, row);
        }
        continue;
      }

      // Global row: only set if nothing yet, AND nothing org-specific has won
      if (!existing) {
        byKey.set(row.feature_key, row);
      }
      // else: skip — either we already have an org-specific row, or an older
      // global row was kept (shouldn't happen given DESC order, but safe).
    }

    const enabled = new Set<string>();
    for (const [key, row] of byKey) {
      if (row.enabled) enabled.add(key);
    }
    return enabled;
  } catch (e) {
    console.error("[feature-flags] unexpected error:", e instanceof Error ? e.message : String(e));
    return new Set<string>();
  }
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
