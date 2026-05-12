"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";

export interface FinanceStats {
  total_collected: number;
  outstanding_balance: number;
  overdue_balance: number;
  collection_rate: number;        // % of dues collected
  active_contracts: number;
  monthly_revenue: number;        // last 30 days
  upcoming_30d_amount: number;    // due in next 30 days
  overdue_residents: number;
}

export async function getFinanceStats(): Promise<FinanceStats> {
  await requireUser();
  const supabase = await createClient();

  // Use raw SQL-ish aggregations via .select. Supabase doesn't expose SUM, so
  // we fetch lightweight rows and aggregate in Node. The DB indexes keep
  // this fast even at 100k rows.
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const last30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [schedules, payments, lastPayments, activeContracts] = await Promise.all([
    supabase.from("installment_schedules")
      .select("total_due, penalty_amount, paid_amount, due_date, status")
      .limit(50000),
    supabase.from("payments")
      .select("payment_amount, payment_status")
      .eq("payment_status", "confirmed")
      .limit(50000),
    supabase.from("payments")
      .select("payment_amount")
      .eq("payment_status", "confirmed")
      .gte("payment_date", last30)
      .limit(50000),
    supabase.from("installment_contracts")
      .select("id", { count: "exact", head: true })
      .eq("contract_status", "active"),
  ]);

  if (schedules.error) throw new Error(schedules.error.message);
  if (payments.error) throw new Error(payments.error.message);

  type ScheduleSlim = { total_due: number; penalty_amount: number; paid_amount: number; due_date: string; status: string };
  const sched = (schedules.data ?? []) as unknown as ScheduleSlim[];

  let outstanding = 0;
  let overdue = 0;
  let upcoming30 = 0;
  const overdueContractIds = new Set<string>();

  for (const s of sched) {
    const due = (Number(s.total_due) + Number(s.penalty_amount)) - Number(s.paid_amount);
    if (due <= 0) continue;
    outstanding += due;
    if (s.due_date < today && s.status !== "paid") {
      overdue += due;
    }
    if (s.due_date >= today && s.due_date <= in30) {
      upcoming30 += due;
    }
  }

  const totalCollected = ((payments.data ?? []) as unknown as Array<{ payment_amount: number }>)
    .reduce((sum, p) => sum + Number(p.payment_amount), 0);

  const monthlyRevenue = ((lastPayments.data ?? []) as unknown as Array<{ payment_amount: number }>)
    .reduce((sum, p) => sum + Number(p.payment_amount), 0);

  // Collection rate = collected / (collected + outstanding)
  const denom = totalCollected + outstanding;
  const collectionRate = denom > 0 ? Math.round((totalCollected / denom) * 100) : 0;

  return {
    total_collected: round2(totalCollected),
    outstanding_balance: round2(outstanding),
    overdue_balance: round2(overdue),
    collection_rate: collectionRate,
    active_contracts: activeContracts.count ?? 0,
    monthly_revenue: round2(monthlyRevenue),
    upcoming_30d_amount: round2(upcoming30),
    overdue_residents: overdueContractIds.size,
  };
}

export interface TopOverdueRow {
  contract_id: string;
  contract_number: string;
  resident_name: string;
  unit_number: string;
  overdue_amount: number;
  oldest_due_date: string;
}

export async function listTopOverdue(limit = 10): Promise<TopOverdueRow[]> {
  await requireUser();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: schedules, error } = await supabase
    .from("installment_schedules")
    .select("contract_id, due_date, total_due, penalty_amount, paid_amount, status")
    .lt("due_date", today)
    .neq("status", "paid")
    .limit(5000);
  if (error) throw new Error(error.message);

  type S = { contract_id: string; due_date: string; total_due: number; penalty_amount: number; paid_amount: number };
  const grouped = new Map<string, { amount: number; oldest: string }>();
  for (const s of (schedules ?? []) as unknown as S[]) {
    const amt = (Number(s.total_due) + Number(s.penalty_amount)) - Number(s.paid_amount);
    if (amt <= 0) continue;
    const prev = grouped.get(s.contract_id) ?? { amount: 0, oldest: s.due_date };
    grouped.set(s.contract_id, {
      amount: prev.amount + amt,
      oldest: s.due_date < prev.oldest ? s.due_date : prev.oldest,
    });
  }

  const contractIds = Array.from(grouped.keys());
  if (contractIds.length === 0) return [];

  const { data: contracts } = await supabase
    .from("installment_contracts")
    .select("id, contract_number, unit_id, resident_id")
    .in("id", contractIds);

  type Contract = { id: string; contract_number: string; unit_id: string; resident_id: string };
  const cs = ((contracts ?? []) as unknown as Contract[]);

  const unitIds = Array.from(new Set(cs.map((c) => c.unit_id)));
  const residentIds = Array.from(new Set(cs.map((c) => c.resident_id)));

  const [unitsRes, residentsRes] = await Promise.all([
    supabase.from("units").select("id, unit_number").in("id", unitIds),
    supabase.from("residents").select("id, first_name, last_name").in("id", residentIds),
  ]);

  const unitMap = new Map<string, string>();
  for (const u of (unitsRes.data ?? []) as unknown as Array<{ id: string; unit_number: string }>) {
    unitMap.set(u.id, u.unit_number);
  }
  const resMap = new Map<string, string>();
  for (const r of (residentsRes.data ?? []) as unknown as Array<{ id: string; first_name: string; last_name: string }>) {
    resMap.set(r.id, `${r.first_name} ${r.last_name}`);
  }

  const rows: TopOverdueRow[] = cs.map((c) => {
    const g = grouped.get(c.id)!;
    return {
      contract_id: c.id,
      contract_number: c.contract_number,
      resident_name: resMap.get(c.resident_id) ?? "—",
      unit_number: unitMap.get(c.unit_id) ?? "—",
      overdue_amount: round2(g.amount),
      oldest_due_date: g.oldest,
    };
  });

  rows.sort((a, b) => b.overdue_amount - a.overdue_amount);
  return rows.slice(0, limit);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
