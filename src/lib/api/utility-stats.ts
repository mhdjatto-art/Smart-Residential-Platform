"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";

export interface UtilityStats {
  active_subscriptions: number;
  electricity_subs: number;
  internet_subs: number;
  gas_orders_pending: number;
  unpaid_bills: number;
  unpaid_amount: number;
  monthly_utility_revenue: number;
  active_meters: number;
}

export async function getUtilityStats(): Promise<UtilityStats> {
  await requireUser();
  const supabase = await createClient();
  const last30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [active, electricity, internet, gasPending, unpaid, paid, meters] = await Promise.all([
    supabase.from("utility_subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("utility_subscriptions").select("id", { count: "exact", head: true }).eq("status", "active").eq("subscription_type", "electricity"),
    supabase.from("utility_subscriptions").select("id", { count: "exact", head: true }).eq("status", "active").eq("subscription_type", "internet"),
    supabase.from("gas_orders").select("id", { count: "exact", head: true }).in("status", ["pending", "scheduled"]),
    supabase.from("utility_bills").select("total_amount, paid_amount").in("status", ["issued", "partial", "overdue"]).limit(10000),
    supabase.from("utility_bills").select("total_amount").eq("status", "paid").gte("paid_at", last30).limit(10000),
    supabase.from("electricity_meters").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  type B = { total_amount: number; paid_amount: number };
  const unpaidSum = ((unpaid.data ?? []) as unknown as B[]).reduce(
    (sum, b) => sum + Math.max(0, Number(b.total_amount) - Number(b.paid_amount)),
    0,
  );
  const monthlyRev = ((paid.data ?? []) as unknown as { total_amount: number }[]).reduce(
    (sum, b) => sum + Number(b.total_amount),
    0,
  );

  const unpaidCount = ((unpaid.data ?? []) as unknown as B[]).filter(
    (b) => Number(b.total_amount) - Number(b.paid_amount) > 0,
  ).length;

  return {
    active_subscriptions: active.count ?? 0,
    electricity_subs: electricity.count ?? 0,
    internet_subs: internet.count ?? 0,
    gas_orders_pending: gasPending.count ?? 0,
    unpaid_bills: unpaidCount,
    unpaid_amount: Math.round(unpaidSum * 100) / 100,
    monthly_utility_revenue: Math.round(monthlyRev * 100) / 100,
    active_meters: meters.count ?? 0,
  };
}
