/**
 * Determine where to send a user after authentication, based on their roles.
 *
 * - Residents land on the mobile shell `/m` (their entire experience lives there)
 * - Everyone else lands on the desktop dashboard `/dashboard`
 *
 * Used by:
 *   - src/app/page.tsx  (root redirect)
 *   - src/middleware.ts (authed user hitting /login)
 *   - login form (success redirect default)
 */
import type { AppRole } from "@/types";

const RESIDENT_HOME = "/m";
const ADMIN_HOME    = "/dashboard";

/**
 * Pure helper — given the role list, returns the appropriate landing path.
 * A user whose ONLY role is "resident" goes to /m. Anyone with an admin/staff
 * role goes to /dashboard. Empty role list also goes to /dashboard (safe fallback).
 */
export function getPostLoginPath(roles: AppRole[] | readonly AppRole[]): string {
  if (!roles || roles.length === 0) return ADMIN_HOME;
  // If ANY role is a non-resident, use the admin dashboard
  const hasNonResident = roles.some((r) => r !== "resident");
  if (hasNonResident) return ADMIN_HOME;
  return RESIDENT_HOME;
}

export const ROUTES = { RESIDENT_HOME, ADMIN_HOME } as const;
