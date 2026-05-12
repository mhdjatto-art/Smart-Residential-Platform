/**
 * Role → capability matrix.
 *
 * This is the SINGLE source of truth for "can role X do action Y" in the UI.
 * It deliberately mirrors the RLS policies — the UI uses it to hide controls,
 * the DB uses RLS to actually enforce. If these ever drift, RLS wins.
 */

import type { AppRole } from "@/types";

export type Capability =
  // Tenancy
  | "organization:read"
  | "organization:write"
  | "compound:read"
  | "compound:write"
  | "building:read"
  | "building:write"
  | "unit:read"
  | "unit:write"
  // People
  | "resident:read"
  | "resident:write"
  | "resident:delete"
  | "user_role:read"
  | "user_role:write"
  // Finance
  | "contract:read"
  | "contract:write"
  | "payment:read"
  | "payment:write"
  | "payment:reverse"
  // Audit
  | "audit:read";

const ALL: readonly Capability[] = [
  "organization:read", "organization:write",
  "compound:read", "compound:write",
  "building:read", "building:write",
  "unit:read", "unit:write",
  "resident:read", "resident:write", "resident:delete",
  "user_role:read", "user_role:write",
  "contract:read", "contract:write",
  "payment:read", "payment:write", "payment:reverse",
  "audit:read",
] as const;

export const ROLE_CAPABILITIES: Record<AppRole, readonly Capability[]> = {
  super_admin: ALL,

  developer_admin: [
    "organization:read", "organization:write",
    "compound:read", "compound:write",
    "building:read", "building:write",
    "unit:read", "unit:write",
    "resident:read", "resident:write", "resident:delete",
    "user_role:read", "user_role:write",
    "contract:read", "contract:write",
    "payment:read", "payment:write", "payment:reverse",
    "audit:read",
  ],

  compound_manager: [
    "organization:read",
    "compound:read", "compound:write",
    "building:read", "building:write",
    "unit:read", "unit:write",
    "resident:read", "resident:write", "resident:delete",
    "user_role:read",
    "contract:read", "contract:write",
    "payment:read", "payment:write", "payment:reverse",
    "audit:read",
  ],

  finance_officer: [
    "organization:read",
    "compound:read",
    "building:read",
    "unit:read",
    "resident:read",
    "contract:read", "contract:write",
    "payment:read", "payment:write", "payment:reverse",
  ],

  maintenance_staff: [
    "compound:read",
    "building:read",
    "unit:read",
    "resident:read",
  ],

  security_staff: [
    "compound:read",
    "building:read",
    "unit:read",
    "resident:read",
  ],

  resident: [
    "compound:read",
    "building:read",
    "unit:read",
    "contract:read",  // their own (RLS enforces)
    "payment:read",   // their own (RLS enforces)
  ],
};

export function hasCapability(roles: AppRole[], capability: Capability): boolean {
  return roles.some((r) => ROLE_CAPABILITIES[r].includes(capability));
}
