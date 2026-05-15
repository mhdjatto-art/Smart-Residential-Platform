import type { AppRole } from "@/types";

export const APP_ROLES: readonly AppRole[] = [
  "super_admin",
  "developer_admin",
  "compound_manager",
  "finance_officer",
  "maintenance_staff",
  "security_staff",
  "resident",
] as const;

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  developer_admin: "Developer Admin",
  compound_manager: "Compound Manager",
  finance_officer: "Finance Officer",
  maintenance_staff: "Maintenance Staff",
  security_staff: "Security Staff",
  resident: "Resident",
};

/** i18n key for an AppRole — pass to `t()` to get the localized label. */
export const ROLE_LABEL_KEYS: Record<AppRole, `roles.${AppRole}`> = {
  super_admin: "roles.super_admin",
  developer_admin: "roles.developer_admin",
  compound_manager: "roles.compound_manager",
  finance_officer: "roles.finance_officer",
  maintenance_staff: "roles.maintenance_staff",
  security_staff: "roles.security_staff",
  resident: "roles.resident",
};

export const STAFF_ROLES: readonly AppRole[] = [
  "super_admin",
  "developer_admin",
  "compound_manager",
  "finance_officer",
  "maintenance_staff",
  "security_staff",
] as const;
