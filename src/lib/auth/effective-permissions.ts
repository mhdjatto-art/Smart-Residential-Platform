/**
 * Phase 17 — Effective capability resolution.
 *
 * Combines:
 *   1. Hardcoded role × capability matrix (src/lib/auth/permissions.ts)
 *   2. Database overrides from `role_capability_overrides`
 *
 * Returns the union, with overrides winning. Used at layout/server level to
 * pass an authoritative capability set down to the Sidebar.
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ROLE_CAPABILITIES, type Capability } from "@/lib/auth/permissions";
import type { AppRole } from "@/types";

interface OverrideRow {
  organization_id: string | null;
  role:            string;
  capability:      string;
  enabled:         boolean;
}

/**
 * Returns the effective capability set for a user given their roles and org.
 *
 * Logic:
 *   - Start with the union of hardcoded capabilities for each role.
 *   - For each override matching (role × capability) for this org OR globally
 *     (NULL org_id), apply: enabled=true ADDS, enabled=false REMOVES.
 *   - Org-specific overrides win over global.
 */
export async function getEffectiveCapabilities(
  roles: AppRole[],
  orgId: string | null,
): Promise<Set<Capability>> {
  // 1. Start with defaults
  const effective = new Set<Capability>();
  for (const role of roles) {
    const caps = ROLE_CAPABILITIES[role] ?? [];
    for (const c of caps) effective.add(c);
  }

  // 2. Load all overrides for these roles (org-specific + global)
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("role_capability_overrides")
    .select("organization_id, role, capability, enabled")
    .in("role", roles);

  if (error || !data) return effective;

  // Group by (role, capability); org-specific wins.
  const byKey = new Map<string, OverrideRow>();
  for (const row of data as OverrideRow[]) {
    const key = `${row.role}::${row.capability}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    if (row.organization_id === orgId && existing.organization_id === null) {
      byKey.set(key, row);
    }
  }

  // 3. Apply overrides
  for (const [, row] of byKey) {
    const cap = row.capability as Capability;
    if (row.enabled) effective.add(cap);
    else effective.delete(cap);
  }

  return effective;
}
