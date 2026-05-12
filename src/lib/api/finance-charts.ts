"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";

export interface MonthlyPoint {
  month: string;          // YYYY-MM
  label: string;          // "Jan 2026"
  collected: number;
  expected: number;
}

export interface AgingBucket {
  label: string;
  amount: number;
  count: number;
}

/**
 * 12-month rolling chart data: how much was collected each month and what was
 * expected. Both numbers respect RLS scope.
 */
export async function getMonthlyChart(): Promise<MonthlyPoint[]> {
  await requireUser();
  const supabase = await createClient();

  const months: MonthlyPoint[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      month,
      label: d.toLocaleString("en-US", { month: "short", year: "numeric" }),
      collected: 0,
      expected: 0,
    });
  }

  const startDate = months[0]!.month + "-01";

  const [payRes, schedRes] = await Promise.all([
    supabase.from("payments")
      .select("payment_date, payment_amount, payment_status")
      .eq("payment_status", "confirmed")
      .gte("payment_date", startDate)
      .limit(50000),
    supabase.from("installment_schedules")
      .select("due_date, total_due, penalty_amount")
      .gte("due_date", startDate)
      .limit(50000),
  ]);

  if (payRes.error) throw new Error(payRes.error.message);
  if (schedRes.error) throw new Error(schedRes.error.message);

  const monthIndex = new Map<string, number>();
  months.forEach((m, idx) => monthIndex.set(m.month, idx));

  for (const p of ((payRes.data ?? []) as unknown as Array<{ payment_date: string; payment_amount: number }>)) {
    const key = p.payment_date.slice(0, 7);
    const idx = monthIndex.get(key);
    if (idx !== undefined) months[idx]!.collected += Number(p.payment_amount);
  }

  for (const s of ((schedRes.data ?? []) as unknown as Array<{ due_date: string; total_due: number; penalty_amount: number }>)) {
    const key = s.due_date.slice(0, 7);
    const idx = monthIndex.get(key);
    if (idx !== undefined) months[idx]!.expected += Number(s.total_due) + Number(s.penalty_amount);
  }

  for (const m of months) {
    m.collected = round2(m.collected);
    m.expected = round2(m.expected);
  }

  return months;
}

/**
 * Aging buckets — how outstanding balances are distributed by age.
 */
export async function getAgingBuckets(): Promise<AgingBucket[]> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("installment_schedules")
    .select("due_date, total_due, penalty_amount, paid_amount, status")
    .neq("status", "paid")
    .limit(50000);

  if (error) throw new Error(error.message);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets: AgingBucket[] = [
    { label: "Current (not due)", amount: 0, count: 0 },
    { label: "1–30 days", amount: 0, count: 0 },
    { label: "31–60 days", amount: 0, count: 0 },
    { label: "61–90 days", amount: 0, count: 0 },
    { label: "90+ days", amount: 0, count: 0 },
  ];

  type S = { due_date: string; total_due: number; penalty_amount: number; paid_amount: number };
  for (const s of ((data ?? []) as unknown as S[])) {
    const due = (Number(s.total_due) + Number(s.penalty_amount)) - Number(s.paid_amount);
    if (due <= 0) continue;
    const dueDate = new Date(s.due_date);
    dueDate.setHours(0, 0, 0, 0);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    let idx: number;
    if (daysOverdue < 0)         idx = 0;
    else if (daysOverdue <= 30)  idx = 1;
    else if (daysOverdue <= 60)  idx = 2;
    else if (daysOverdue <= 90)  idx = 3;
    else                          idx = 4;

    buckets[idx]!.amount += due;
    buckets[idx]!.count += 1;
  }

  for (const b of buckets) b.amount = round2(b.amount);
  return buckets;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
