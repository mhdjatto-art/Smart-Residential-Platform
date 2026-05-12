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

export const ROLE_CAPABILITIES: Record<AppRole, readonly Capability[]> = {
  super_admin: ALL,

  developer_admin: ALL.filter((c) => true),

  compound_manager: [
    "organization:read",
    "compound:read","compound:write",
    "building:read","building:write",
    "unit:read","unit:write",
    "resident:read","resident:write","resident:delete",
    "user_role:read",
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
    "audit:read",
  ],

  finance_officer: [
    "organization:read", "compound:read", "building:read", "unit:read", "resident:read",
    "contract:read","contract:write",
    "payment:read","payment:write","payment:reverse",
    "ticket:read",
    "utility:read","utility:write",
    "marketplace:read","marketplace:write",
    "analytics:read",
    "alerts:read","alerts:write",
    "audit:read",
  ],

  maintenance_staff: [
    "compound:read", "building:read", "unit:read", "resident:read",
    "ticket:read","ticket:write",
    "facility:read",
    "utility:read","utility:write",
    "marketplace:read",
    "alerts:read",
  ],

  security_staff: [
    "compound:read","building:read","unit:read","resident:read",
    "ticket:read",
    "visitor:read","visitor:write",
    "facility:read",
  ],

  resident: [
    "compound:read","building:read","unit:read",
    "contract:read", "payment:read",
    "ticket:read","ticket:write",
    "visitor:read","visitor:write",
    "facility:read",
    "booking:read","booking:write",
    "utility:read",
    "marketplace:read","marketplace:write",
  ],
};

export function hasCapability(roles: AppRole[], capability: Capability): boolean {
  return roles.some((r) => ROLE_CAPABILITIES[r].includes(capability));
}
