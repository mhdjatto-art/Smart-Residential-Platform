"use server";

/**
 * Analytics dashboard data loader.
 *
 * Every query is wrapped in safeQuery() so a single failure (table missing,
 * RLS denial, etc.) never crashes the whole dashboard — the affected card
 * just shows 0 / empty.
 */

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";

export interface AnalyticsKpis {
  total_revenue_30d: number;
  collection_rate: number;       // % of installments paid on time
  occupancy_rate: number;        // % of units occupied
  overdue_amount: number;
  overdue_count: number;
  active_residents: number;
  active_tickets: number;
  pending_bookings: number;
  pending_visitors: number;
}

export interface MonthlyRevenueBucket {
  month: string;                 // YYYY-MM
  installments: number;
  utilities: number;
}

export interface TopResident {
  resident_name: string;
  total_paid: number;
  currency: string;
}

export interface AnalyticsData {
  kpis: AnalyticsKpis;
  monthly_revenue: MonthlyRevenueBucket[];
  top_payers: TopResident[];
  top_overdue: Array<{ resident_name: string; days_overdue: number; amount: number; currency: string }>;
  ticket_by_status: Array<{ status: string; count: number }>;
  utility_consumption: Array<{ month: string; electricity: number; water: number }>;
}

async function safeCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  label: string,
): Promise<number> {
  try {
    const { count, error } = await query;
    if (error) {
      console.error(`[analytics] ${label} failed:`, error.message);
      return 0;
    }
    return count ?? 0;
  } catch (e) {
    console.error(`[analytics] ${label} threw:`, e instanceof Error ? e.message : String(e));
    return 0;
  }
}

async function safeQuery<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  label: string,
): Promise<T[]> {
  try {
    const { data, error } = await query;
    if (error) {
      console.error(`[analytics] ${label} failed:`, error.message);
      return [];
    }
    return (data ?? []) as T[];
  } catch (e) {
    console.error(`[analytics] ${label} threw:`, e instanceof Error ? e.message : String(e));
    return [];
  }
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const last30 = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
  const sixMonthsAgo = new Date(Date.now() - 180 * 86400 * 1000).toISOString().slice(0, 10);

  // ── KPIs ──────────────────────────────────────────────────
  const [
    paymentsCount, paymentsSum,
    unitsTotal, unitsOccupied,
    installmentsOverdue,
    residentsActive,
    ticketsActive,
    bookingsPending,
    visitorsPending,
  ] = await Promise.all([
    safeCount(supabase.from("payments").select("id", { count: "exact", head: true }).gte("payment_date", last30.slice(0,10)), "payments_count"),
    safeQuery<{ payment_amount: number }>(supabase.from("payments").select("payment_amount").gte("payment_date", last30.slice(0,10)).eq("payment_status", "confirmed"), "payments_sum"),
    safeCount(supabase.from("units").select("id", { count: "exact", head: true }), "units_total"),
    safeCount(supabase.from("units").select("id", { count: "exact", head: true }).eq("status", "occupied"), "units_occupied"),
    safeQuery<{ total_due: number; paid_amount: number; penalty_amount: number }>(supabase.from("installment_schedules").select("total_due, paid_amount, penalty_amount").in("status", ["pending","partial","overdue"]).lt("due_date", new Date().toISOString().slice(0,10)), "installments_overdue"),
    safeCount(supabase.from("residents").select("id", { count: "exact", head: true }).eq("status", "active"), "residents_active"),
    safeCount(supabase.from("tickets").select("id", { count: "exact", head: true }).in("status", ["open","assigned","in_progress","pending"]), "tickets_active"),
    safeCount(supabase.from("facility_bookings").select("id", { count: "exact", head: true }).eq("status", "pending"), "bookings_pending"),
    safeCount(supabase.from("visitors").select("id", { count: "exact", head: true }).eq("status", "pending"), "visitors_pending"),
  ]);

  const totalRevenue30d = paymentsSum.reduce((s, p) => s + Number(p.payment_amount ?? 0), 0);
  const overdueSum = installmentsOverdue.reduce(
    (s, r) => s + Math.max(0, Number(r.total_due) + Number(r.penalty_amount ?? 0) - Number(r.paid_amount)), 0);

  // Collection rate: paid installments in last 30d / due in last 30d
  const dueInLast30 = await safeQuery<{ status: string }>(
    supabase.from("installment_schedules").select("status").gte("due_date", last30.slice(0,10)),
    "due_last30",
  );
  const dueTotal = dueInLast30.length;
  const dueOnTime = dueInLast30.filter((r) => r.status === "paid").length;
  const collectionRate = dueTotal === 0 ? 100 : Math.round((dueOnTime / dueTotal) * 100);

  const occupancyRate = unitsTotal === 0 ? 0 : Math.round((unitsOccupied / unitsTotal) * 100);

  // ── Monthly revenue (last 6 months) ───────────────────────
  const recentPayments = await safeQuery<{ payment_amount: number; payment_date: string }>(
    supabase.from("payments").select("payment_amount, payment_date").gte("payment_date", sixMonthsAgo).eq("payment_status", "confirmed"),
    "recent_payments",
  );
  const recentUtilityBills = await safeQuery<{ paid_amount: number; paid_at: string | null }>(
    supabase.from("utility_bills").select("paid_amount, paid_at").gte("paid_at", sixMonthsAgo).eq("status", "paid"),
    "recent_utility",
  );

  const months: Record<string, MonthlyRevenueBucket> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    months[key] = { month: key, installments: 0, utilities: 0 };
  }
  for (const p of recentPayments) {
    const key = p.payment_date.slice(0, 7);
    if (months[key]) months[key].installments += Number(p.payment_amount);
  }
  for (const b of recentUtilityBills) {
    if (!b.paid_at) continue;
    const key = b.paid_at.slice(0, 7);
    if (months[key]) months[key].utilities += Number(b.paid_amount);
  }

  // ── Top 5 payers (last 30d) ───────────────────────────────
  const topPayers = await safeQuery<{ resident_id: string; payment_amount: number; resident: { first_name: string | null; last_name: string | null } | null }>(
    supabase.from("payments")
      .select("resident_id, payment_amount, resident:residents(first_name, last_name)")
      .gte("payment_date", last30.slice(0,10))
      .eq("payment_status", "confirmed")
      .limit(500),
    "top_payers",
  );
  const byResident = new Map<string, { name: string; total: number }>();
  for (const p of topPayers) {
    const name = p.resident
      ? [p.resident.first_name, p.resident.last_name].filter(Boolean).join(" ") || "Unknown"
      : "Unknown";
    const cur = byResident.get(p.resident_id) ?? { name, total: 0 };
    cur.total += Number(p.payment_amount);
    byResident.set(p.resident_id, cur);
  }
  const top5Payers = Array.from(byResident.values())
    .sort((a, b) => b.total - a.total).slice(0, 5)
    .map((r) => ({ resident_name: r.name, total_paid: r.total, currency: "USD" }));

  // ── Top 5 most overdue residents ──────────────────────────
  const overdueByResident = await safeQuery<{
    resident_id: string | null; total_due: number; paid_amount: number; penalty_amount: number;
    due_date: string;
    contract: { resident: { first_name: string | null; last_name: string | null } | null } | null;
  }>(
    supabase.from("installment_schedules")
      .select("total_due, paid_amount, penalty_amount, due_date, contract:installment_contracts(resident:residents(first_name, last_name))")
      .in("status", ["pending","partial","overdue"])
      .lt("due_date", new Date().toISOString().slice(0,10))
      .limit(500),
    "overdue_by_resident",
  );
  const overdueAgg = new Map<string, { name: string; days: number; amount: number }>();
  const today = Date.now();
  for (const r of overdueByResident) {
    const name = r.contract?.resident
      ? [r.contract.resident.first_name, r.contract.resident.last_name].filter(Boolean).join(" ") || "Unknown"
      : "Unknown";
    const days = Math.floor((today - new Date(r.due_date).getTime()) / (86400 * 1000));
    const amt = Math.max(0, Number(r.total_due) + Number(r.penalty_amount ?? 0) - Number(r.paid_amount));
    const cur = overdueAgg.get(name) ?? { name, days: 0, amount: 0 };
    cur.amount += amt;
    if (days > cur.days) cur.days = days;
    overdueAgg.set(name, cur);
  }
  const topOverdue = Array.from(overdueAgg.values())
    .sort((a, b) => b.amount - a.amount).slice(0, 5)
    .map((r) => ({ resident_name: r.name, days_overdue: r.days, amount: r.amount, currency: "USD" }));

  // ── Tickets by status ─────────────────────────────────────
  const tickets = await safeQuery<{ status: string }>(
    supabase.from("tickets").select("status"),
    "tickets_status",
  );
  const byStatus = new Map<string, number>();
  for (const t of tickets) byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1);
  const ticketByStatus = Array.from(byStatus.entries()).map(([status, count]) => ({ status, count }));

  // ── Utility consumption (last 6 months) ───────────────────
  const utilities = await safeQuery<{ utility_type: string; consumption: number | null; billing_period_end: string }>(
    supabase.from("utility_bills")
      .select("utility_type, consumption, billing_period_end")
      .gte("billing_period_end", sixMonthsAgo)
      .in("utility_type", ["electricity", "water"])
      .limit(2000),
    "utility_consumption",
  );
  const utilMonths: Record<string, { month: string; electricity: number; water: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    utilMonths[key] = { month: key, electricity: 0, water: 0 };
  }
  for (const u of utilities) {
    const key = u.billing_period_end.slice(0, 7);
    if (!utilMonths[key]) continue;
    if (u.utility_type === "electricity") utilMonths[key].electricity += Number(u.consumption ?? 0);
    if (u.utility_type === "water")       utilMonths[key].water       += Number(u.consumption ?? 0);
  }

  return {
    kpis: {
      total_revenue_30d: totalRevenue30d,
      collection_rate: collectionRate,
      occupancy_rate: occupancyRate,
      overdue_amount: overdueSum,
      overdue_count: installmentsOverdue.length,
      active_residents: residentsActive,
      active_tickets: ticketsActive,
      pending_bookings: bookingsPending,
      pending_visitors: visitorsPending,
    },
    monthly_revenue: Object.values(months),
    top_payers: top5Payers,
    top_overdue: topOverdue,
    ticket_by_status: ticketByStatus,
    utility_consumption: Object.values(utilMonths),
  };
}
