/**
 * Role → capability matrix. Single source of truth for UI gating. RLS is the
 * actual gate at the DB level — these capabilities just hide UI controls.
 */

import type { AppRole } from "@/types";

export type Capability =
  | "organization:read" | "organization:write"
  | "compound:read" | "compound:write"
  | "building:read" | "building:write"
  | "unit:read" | "unit:write"
  | "resident:read" | "resident:write" | "resident:delete"
  | "user_role:read" | "user_role:write"
  | "contract:read" | "contract:write"
  | "payment:read"  | "payment:write" | "payment:reverse"
  | "ticket:read"   | "ticket:write"
  | "visitor:read"  | "visitor:write"
  | "facility:read" | "facility:write"
  | "booking:read"  | "booking:write"
  | "utility:read"  | "utility:write"
  | "marketplace:read" | "marketplace:write" | "marketplace:moderate"
  | "analytics:read" | "analytics:write"
  | "automation:read" | "automation:write"
  | "alerts:read"   | "alerts:write"
  | "branding:read" | "branding:write"
  | "domains:read"  | "domains:write"
  | "billing:read"  | "billing:write"
  | "pricing:read"  | "pricing:write"
  | "integrations:read" | "integrations:write"
  | "devices:read" | "devices:write"
  | "access:read"  | "access:write"
  | "parking:read" | "parking:write"
  | "erp:read"     | "erp:write"
  | "saas:admin"
  | "audit:read";

const ALL: readonly Capability[] = [
  "organization:read","organization:write",
  "compound:read","compound:write",
  "building:read","building:write",
  "unit:read","unit:write",
  "resident:read","resident:write","resident:delete",
  "user_role:read","user_role:write",
  "contract:read","contract:write",
  "payment:read","payment:write","payment:reverse",
  "ticket:read","ticket:write",
  "visitor:read","visitor:write",
  "facility:read","facility:write",
  "booking:read","booking:write",
  "utility:read","utility:write",
  "marketplace:read","marketplace:write","marketplace:moderate",
  "analytics:read","analytics:write",
  "automation:read","automation:write",
  "alerts:read","alerts:write",
  "branding:read","branding:write",
  "domains:read","domains:write",
  "billing:read","billing:write",
  "pricing:read","pricing:write",
  "integrations:read","integrations:write",
  "devices:read","devices:write",
  "access:read","access:write",
  "parking:read","parking:write",
  "erp:read","erp:write",
  "saas:admin",
  "audit:read",
] as const;

/**
 * Phase 19B — Tightly scoped role defaults.
 *
 * Philosophy: each non-admin role only sees the modules that match their job.
 * No "kitchen sink" capability sets. Cross-domain visibility (e.g. finance
 * seeing marketplace) is intentionally removed — if you need an exception
 * for a specific user, grant it via role_capability_overrides in the
 * Master Permissions Center.
 */
export const ROLE_CAPABILITIES: Record<AppRole, readonly Capability[]> = {
  // Full platform owner — every capability.
  super_admin: ALL,

  // Same as super_admin (DevOps / platform engineers).
  developer_admin: ALL.filter((c) => true),

  // Operations manager for an organization. Runs the day-to-day:
  // residents, contracts, payments, tickets, visitors, facilities,
  // utilities, marketplace, IoT, branding, billing.
  // Excluded: saas:admin (platform-level), organization:write (multi-org),
  // erp:* (specialised finance integration).
  compound_manager: [
    "organization:read",
    "compound:read","compound:write",
    "building:read","building:write",
    "unit:read","unit:write",
    "resident:read","resident:write","resident:delete",
    "user_role:read",
    "contract:read","contract:write",
    "payment:read","payment:write",
    "ticket:read","ticket:write",
    "visitor:read","visitor:write",
    "facility:read","facility:write",
    "booking:read","booking:write",
    "utility:read","utility:write",
    "marketplace:read","marketplace:write","marketplace:moderate",
    "analytics:read",
    "automation:read","automation:write",
    "alerts:read","alerts:write",
    "branding:read","branding:write",
    "billing:read","billing:write",
    "pricing:read","pricing:write",
    "integrations:read",
    "devices:read","devices:write",
    "access:read","access:write",
    "parking:read","parking:write",
    "audit:read",
  ],

  // ─── Pure finance scope ─── Only sees money-related screens.
  // No marketplace, no operations, no IoT.
  finance_officer: [
    "compound:read",            // dashboard context (read-only)
    "building:read",            // for filtering payments by building
    "unit:read",                // for filtering payments by unit
    "resident:read",            // know who owes what
    "contract:read","contract:write",
    "payment:read","payment:write","payment:reverse",
    "utility:read","utility:write",
    "pricing:read","pricing:write",
    "billing:read",
    "analytics:read",
    "erp:read","erp:write",     // accounting integration is finance's job
    "alerts:read",
    "audit:read",
  ],

  // ─── Pure maintenance scope ─── Tickets + facilities only.
  // No payments, no marketplace, no visitor management.
  maintenance_staff: [
    "compound:read",
    "building:read",
    "unit:read",
    "resident:read",            // see whose ticket they're working on
    "ticket:read","ticket:write",
    "facility:read","facility:write",
    "booking:read",             // see scheduled facility bookings
    "utility:read","utility:write",  // meters/sensors for diagnostics
    "devices:read","devices:write",  // IoT troubleshooting
    "alerts:read",
  ],

  // ─── Pure security scope ─── Visitors, access, parking.
  // No payments, no marketplace, no maintenance.
  security_staff: [
    "compound:read",
    "building:read",
    "unit:read",
    "resident:read",            // verify visitor's host
    "visitor:read","visitor:write",
    "access:read","access:write",
    "parking:read","parking:write",
    "ticket:read",              // read-only awareness of issues
    "alerts:read",
  ],

  // Resident — only the things relevant to them as a tenant/owner.
  // They access /m exclusively; these caps just exist for the rare case
  // they hit a desktop URL.
  resident: [
    "compound:read","building:read","unit:read",
    "contract:read","payment:read",
    "ticket:read","ticket:write",       // own tickets
    "visitor:read","visitor:write",     // own visitors
    "booking:read","booking:write",     // own bookings
    "facility:read",
    "utility:read",
    "marketplace:read","marketplace:write",  // resident marketplace browsing
  ],
};

export function hasCapability(roles: AppRole[], capability: Capability): boolean {
  return roles.some((r) => ROLE_CAPABILITIES[r].includes(capability));
}
