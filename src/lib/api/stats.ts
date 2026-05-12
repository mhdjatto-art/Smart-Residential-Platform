"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";

export interface DashboardStats {
  compounds: number;
  buildings: number;
  units: number;
  occupied_units: number;
  vacant_units: number;
  residents: number;
  owners: number;
  tenants: number;
  recent_move_ins: number;
  recent_move_outs: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await requireUser();
  const supabase = await createClient();

  // All queries respect RLS — we get the slice the caller is allowed to see.
  const [compounds, buildings, units, occupied, vacant, residents, owners, tenants, moveIns, moveOuts] = await Promise.all([
    supabase.from("compounds").select("id", { count: "exact", head: true }),
    supabase.from("buildings").select("id", { count: "exact", head: true }),
    supabase.from("units").select("id", { count: "exact", head: true }),
    supabase.from("units").select("id", { count: "exact", head: true }).eq("status", "occupied"),
    supabase.from("units").select("id", { count: "exact", head: true }).eq("status", "vacant"),
    supabase.from("residents").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("unit_assignments").select("id", { count: "exact", head: true })
      .eq("assignment_type", "owner").eq("status", "active"),
    supabase.from("unit_assignments").select("id", { count: "exact", head: true })
      .eq("assignment_type", "tenant").eq("status", "active"),
    supabase.from("unit_assignments").select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gte("start_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    supabase.from("unit_assignments").select("id", { count: "exact", head: true })
      .eq("status", "ended")
      .gte("end_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
  ]);

  return {
    compounds: compounds.count ?? 0,
    buildings: buildings.count ?? 0,
    units: units.count ?? 0,
    occupied_units: occupied.count ?? 0,
    vacant_units: vacant.count ?? 0,
    residents: residents.count ?? 0,
    owners: owners.count ?? 0,
    tenants: tenants.count ?? 0,
    recent_move_ins: moveIns.count ?? 0,
    recent_move_outs: moveOuts.count ?? 0,
  };
}
