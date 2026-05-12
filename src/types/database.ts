/**
 * Hand-written types that match the Supabase schema. After running migrations
 * against a live project, regenerate this file with:
 *
 *   pnpm db:types
 *
 * The shape mirrors what `supabase gen types typescript` produces so the
 * generated output is a drop-in replacement.
 */

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          status: Database["public"]["Enums"]["organization_status"];
          contact_email: string | null;
          contact_phone: string | null;
          country_code: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["organizations"]["Row"]> & {
          name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Row"]>;
      };
      compounds: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          slug: string;
          status: Database["public"]["Enums"]["compound_status"];
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          region: string | null;
          country_code: string | null;
          postal_code: string | null;
          timezone: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["compounds"]["Row"]> & {
          organization_id: string;
          name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["compounds"]["Row"]>;
      };
      buildings: {
        Row: {
          id: string;
          organization_id: string;
          compound_id: string;
          name: string;
          code: string | null;
          floors: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["buildings"]["Row"]> & {
          organization_id: string;
          compound_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["buildings"]["Row"]>;
      };
      units: {
        Row: {
          id: string;
          organization_id: string;
          compound_id: string;
          building_id: string;
          unit_number: string;
          unit_type: Database["public"]["Enums"]["unit_type"];
          status: Database["public"]["Enums"]["unit_status"];
          floor: number | null;
          area_sqm: number | null;
          bedrooms: number | null;
          bathrooms: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["units"]["Row"]> & {
          organization_id: string;
          compound_id: string;
          building_id: string;
          unit_number: string;
        };
        Update: Partial<Database["public"]["Tables"]["units"]["Row"]>;
      };
      residents: {
        Row: {
          id: string;
          organization_id: string;
          compound_id: string;
          unit_id: string;
          user_id: string | null;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          tenancy_type: Database["public"]["Enums"]["tenancy_type"];
          status: Database["public"]["Enums"]["resident_status"];
          move_in_date: string | null;
          move_out_date: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["residents"]["Row"]> & {
          organization_id: string;
          compound_id: string;
          unit_id: string;
          first_name: string;
          last_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["residents"]["Row"]>;
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string | null;
          compound_id: string | null;
          role: Database["public"]["Enums"]["app_role"];
          is_primary: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["user_roles"]["Row"]> & {
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Row"]>;
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          organization_id: string | null;
          compound_id: string | null;
          table_name: string;
          row_id: string | null;
          action: "insert" | "update" | "delete";
          diff: Json | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_super_admin: { Args: { p_user?: string }; Returns: boolean };
      user_organization_ids: { Args: { p_user?: string }; Returns: string[] };
      user_compound_ids: { Args: { p_user?: string }; Returns: string[] };
      user_has_management_role: {
        Args: { p_org: string; p_compound?: string | null; p_user?: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role:
        | "super_admin"
        | "developer_admin"
        | "compound_manager"
        | "finance_officer"
        | "maintenance_staff"
        | "security_staff"
        | "resident";
      organization_status: "active" | "suspended" | "archived";
      compound_status: "active" | "inactive" | "archived";
      unit_status: "vacant" | "occupied" | "reserved" | "maintenance";
      unit_type: "apartment" | "villa" | "townhouse" | "studio" | "duplex" | "penthouse" | "other";
      resident_status: "active" | "pending" | "former";
      tenancy_type: "owner" | "tenant" | "family_member" | "guest";
    };
  };
}
