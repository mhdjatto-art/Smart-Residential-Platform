/**
 * Server-side auth guards.
 *
 * These are the ONLY way Server Components / Server Actions should pull the
 * current user. They do three things:
 *
 *   1. Refuse the request if no session exists.
 *   2. Hydrate roles, organization IDs, and compound IDs in a single round-trip.
 *   3. Provide narrowing helpers (`requireRole`, `requireOrganization`).
 *
 * Database RLS is the actual gate — these guards exist so that the UI can
 * fail fast with a clean redirect instead of rendering a page that's going
 * to return zero rows.
 */

import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, CurrentUser } from "@/types";

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Resolve the authenticated user along with their roles + tenant scope.
 * Redirects to /login if unauthenticated.
 */
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("*")
    .eq("user_id", user.id);

  if (rolesError) {
    // The user is authenticated but we can't read their roles — most likely
    // an RLS misconfiguration. Surface this loudly rather than silently
    // dropping them to a blank dashboard.
    throw new Error(`Failed to load user roles: ${rolesError.message}`);
  }

  const isSuperAdmin = (roles ?? []).some((r) => r.role === "super_admin");

  const organizationIds = Array.from(
    new Set((roles ?? []).map((r) => r.organization_id).filter((v): v is string => !!v)),
  );

  const compoundIds = Array.from(
    new Set((roles ?? []).map((r) => r.compound_id).filter((v): v is string => !!v)),
  );

  return {
    id: user.id,
    email: user.email ?? null,
    roles: roles ?? [],
    isSuperAdmin,
    organizationIds,
    compoundIds,
  };
}

/** Like requireUser but redirects to /login if no session — no roles fetched. */
export async function requireSession(): Promise<{ id: string; email: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { id: user.id, email: user.email ?? null };
}

/**
 * Require that the current user holds at least one of the given roles.
 * Used in dashboard pages to gate access (e.g. only `developer_admin` can
 * see the organizations management page).
 */
export async function requireRole(allowed: AppRole[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.isSuperAdmin) return user;
  const has = user.roles.some((r) => allowed.includes(r.role));
  if (!has) {
    throw new AuthorizationError(`Requires one of: ${allowed.join(", ")}`);
  }
  return user;
}

/** True if the user has any management (non-resident) role. */
export function isStaff(user: CurrentUser): boolean {
  if (user.isSuperAdmin) return true;
  return user.roles.some((r) => r.role !== "resident");
}

/** Pick the primary org for the UI when the user belongs to multiple. */
export function pickPrimaryOrganization(user: CurrentUser): string | null {
  const primary = user.roles.find((r) => r.is_primary && r.organization_id);
  return primary?.organization_id ?? user.organizationIds[0] ?? null;
}
