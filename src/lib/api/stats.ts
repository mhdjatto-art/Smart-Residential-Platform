"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";

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

/**
 * Safely count rows in a table with optional filters. Returns 0 on any error
 * (missing table, missing column, RLS denial) and logs the failure so it
 * shows up in Vercel runtime logs. This way the dashboard never crashes
 * because one widget had a problem.
 */
async function safeCount(
  label: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
): Promise<number> {
  try {
    const { count, error } = await query;
    if (error) {
      logger.error("dashboard-stats", `${label} failed`, error);
      return 0;
    }
    return count ?? 0;
  } catch (e) {
    logger.error("dashboard-stats", `${label} threw`, e);
    return 0;
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await requireUser();
  const supabase = await createClient();
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Run every query in parallel but isolate failures so one bad table doesn't
  // bring the whole dashboard down.
  const [
    compounds,
    buildings,
    units,
    occupied,
    vacant,
    residents,
    owners,
    tenants,
    moveIns,
    moveOuts,
  ] = await Promise.all([
    safeCount("compounds", supabase.from("compounds").select("id", { count: "exact", head: true })),
    safeCount("buildings", supabase.from("buildings").select("id", { count: "exact", head: true })),
    safeCount("units", supabase.from("units").select("id", { count: "exact", head: true })),
    safeCount(
      "occupied_units",
      supabase.from("units").select("id", { count: "exact", head: true }).eq("status", "occupied"),
    ),
    safeCount(
      "vacant_units",
      supabase.from("units").select("id", { count: "exact", head: true }).eq("status", "vacant"),
    ),
    safeCount(
      "residents",
      supabase.from("residents").select("id", { count: "exact", head: true }).eq("status", "active"),
    ),
    // Fall back to residents.tenancy_type if unit_assignments table or columns are missing.
    safeCount(
      "owners",
      supabase
        .from("residents")
        .select("id", { count: "exact", head: true })
        .eq("tenancy_type", "owner")
        .eq("status", "active"),
    ),
    safeCount(
      "tenants",
      supabase
        .from("residents")
        .select("id", { count: "exact", head: true })
        .eq("tenancy_type", "tenant")
        .eq("status", "active"),
    ),
    safeCount(
      "recent_move_ins",
      supabase
        .from("residents")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .gte("move_in_date", last30),
    ),
    safeCount(
      "recent_move_outs",
      supabase
        .from("residents")
        .select("id", { count: "exact", head: true })
        .not("move_out_date", "is", null)
        .gte("move_out_date", last30),
    ),
  ]);

  return {
    compounds,
    buildings,
    units,
    occupied_units: occupied,
    vacant_units: vacant,
    residents,
    owners,
    tenants,
    recent_move_ins: moveIns,
    recent_move_outs: moveOuts,
  };
}
