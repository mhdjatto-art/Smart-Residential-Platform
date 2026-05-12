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

export const STAFF_ROLES: readonly AppRole[] = [
  "super_admin",
  "developer_admin",
  "compound_manager",
  "finance_officer",
  "maintenance_staff",
  "security_staff",
] as const;
