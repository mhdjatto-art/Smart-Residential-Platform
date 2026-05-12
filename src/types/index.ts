import type { Database } from "./database";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type UnitStatus = Database["public"]["Enums"]["unit_status"];
export type UnitType = Database["public"]["Enums"]["unit_type"];
export type ResidentStatus = Database["public"]["Enums"]["resident_status"];
export type TenancyType = Database["public"]["Enums"]["tenancy_type"];

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Compound = Database["public"]["Tables"]["compounds"]["Row"];
export type Building = Database["public"]["Tables"]["buildings"]["Row"];
export type Unit = Database["public"]["Tables"]["units"]["Row"];
export type Resident = Database["public"]["Tables"]["residents"]["Row"];
export type UserRole = Database["public"]["Tables"]["user_roles"]["Row"];

export interface CurrentUser {
  id: string;
  email: string | null;
  roles: UserRole[];
  isSuperAdmin: boolean;
  organizationIds: string[];
  compoundIds: string[];
}

export type Result<T, E = string> = { ok: true; data: T } | { ok: false; error: E };
