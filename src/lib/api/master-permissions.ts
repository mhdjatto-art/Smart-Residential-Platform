"use server";

/**
 * Master permissions control — Phase 17.
 *
 * Lets super_admin / developer_admin manage:
 *   1. Feature flags (entire modules on/off per organization)
 *   2. Role capability overrides (fine-grained role × capability grid)
 *
 * The defaults live in code (src/lib/auth/permissions.ts). Anything written to
 * `role_capability_overrides` wins over the default. Likewise for feature_flags.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";

export interface FeatureFlag {
  id:              string;
  organization_id: string | null;
  feature_key:     string;
  enabled:         boolean;
  metadata:        Record<string, unknown>;
  updated_at:      string;
}

export interface RoleCapabilityOverride {
  id:              string;
  organization_id: string | null;
  role:            string;
  capability:      string;
  enabled:         boolean;
  updated_at:      string;
}

/* ─── feature_flags ──────────────────────────────────────────────────────── */

/** List flags. `orgId === null` → global defaults; pass an org id for that org's view. */
export async function listFeatureFlags(orgId: string | null): Promise<FeatureFlag[]> {
  await requireRole(["super_admin","developer_admin","compound_manager"]);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any).from("feature_flags").select("*").order("feature_key");
  if (orgId === null) q = q.is("organization_id", null);
  else q = q.eq("organization_id", orgId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as FeatureFlag[];
}

/** Toggle a feature for an org (creates the row if missing). */
export async function setFeatureFlag(
  orgId:      string | null,
  featureKey: string,
  enabled:    boolean,
  metadata:   Record<string, unknown> = {},
): Promise<void> {
  await requireRole(["super_admin","developer_admin"]);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("feature_flags").upsert(
    {
      organization_id: orgId,
      feature_key:     featureKey,
      enabled,
      metadata,
      updated_at:      new Date().toISOString(),
    },
    { onConflict: "organization_id,feature_key" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/master/permissions");
}

/* ─── role_capability_overrides ──────────────────────────────────────────── */

export async function listRoleCapabilityOverrides(orgId: string | null): Promise<RoleCapabilityOverride[]> {
  await requireRole(["super_admin","developer_admin","compound_manager"]);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any).from("role_capability_overrides").select("*").order("role").order("capability");
  if (orgId === null) q = q.is("organization_id", null);
  else q = q.eq("organization_id", orgId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as RoleCapabilityOverride[];
}

export async function setRoleCapabilityOverride(
  orgId:      string | null,
  role:       string,
  capability: string,
  enabled:    boolean,
): Promise<void> {
  await requireRole(["super_admin","developer_admin"]);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("role_capability_overrides").upsert(
    {
      organization_id: orgId,
      role,
      capability,
      enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,role,capability" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/master/permissions");
}

/** Wipe an override so the code default takes over again. */
export async function clearRoleCapabilityOverride(
  orgId:      string | null,
  role:       string,
  capability: string,
): Promise<void> {
  await requireRole(["super_admin","developer_admin"]);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any).from("role_capability_overrides")
    .delete()
    .eq("role", role)
    .eq("capability", capability);
  if (orgId === null) q = q.is("organization_id", null);
  else q = q.eq("organization_id", orgId);
  const { error } = await q;
  if (error) throw new Error(error.message);
  revalidatePath("/master/permissions");
}

/* ─── Lightweight feature-check (used by other pages to gate UI) ────────── */

/** Returns true if a feature is enabled for the given org, with sensible defaults. */
export async function isFeatureEnabled(orgId: string | null, featureKey: string): Promise<boolean> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .rpc("is_feature_enabled", { p_org_id: orgId, p_feature: featureKey });
  // RPC defaults to true if no row exists.
  return data ?? true;
}
