"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";

export interface OperationsStats {
  open_tickets: number;
  urgent_tickets: number;
  sla_breaches: number;
  active_jobs: number;
  visitors_today: number;
  pending_bookings: number;
  pending_visitors: number;
  active_technicians: number;
}

export async function getOperationsStats(): Promise<OperationsStats> {
  await requireUser();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const [
    openTickets, urgent, slaBreached, activeJobs,
    visitorsToday, pendingBookings, pendingVisitors, technicians,
  ] = await Promise.all([
    supabase.from("tickets").select("id", { count: "exact", head: true }).in("status", ["open","assigned","in_progress","pending"]),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("priority", "urgent").not("status", "in", "(resolved,closed)"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).lt("sla_due_date", now).not("status", "in", "(resolved,closed)"),
    supabase.from("maintenance_jobs").select("id", { count: "exact", head: true }).in("status", ["scheduled","in_progress"]),
    supabase.from("visitors").select("id", { count: "exact", head: true }).gte("scheduled_date", today).lt("scheduled_date", tomorrow),
    supabase.from("facility_bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("visitors").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("technicians").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  return {
    open_tickets: openTickets.count ?? 0,
    urgent_tickets: urgent.count ?? 0,
    sla_breaches: slaBreached.count ?? 0,
    active_jobs: activeJobs.count ?? 0,
    visitors_today: visitorsToday.count ?? 0,
    pending_bookings: pendingBookings.count ?? 0,
    pending_visitors: pendingVisitors.count ?? 0,
    active_technicians: technicians.count ?? 0,
  };
}
