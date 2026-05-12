"use server";

/**
 * Resident-scoped server actions for the mobile shell.
 *
 * These are thin, RLS-trusted queries that pull only the current user's data
 * for the mobile dashboard widgets. The business logic lives in Phase 1–6 —
 * this module just composes a fast, mobile-shaped read.
 */

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";

export interface ResidentContext {
  user_id: string;
  resident_id: string | null;
  full_name: string | null;
  organization_id: string | null;
  compound_id: string | null;
  unit_id: string | null;
  currency: string;
}

async function loadResidentContext(): Promise<ResidentContext> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("residents")
    .select("id,first_name,last_name,organization_id,compound_id,unit_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const residentRow = r as { id: string; first_name: string | null; last_name: string | null; organization_id: string; compound_id: string | null; unit_id: string | null } | null;
  const fullName = residentRow
    ? [residentRow.first_name, residentRow.last_name].filter(Boolean).join(" ") || null
    : null;
  let currency = "USD";
  if (residentRow?.organization_id) {
    const { data: org } = await supabase.from("organizations").select("currency").eq("id", residentRow.organization_id).maybeSingle();
    currency = (org as { currency?: string } | null)?.currency ?? "USD";
  }
  return {
    user_id: user.id,
    resident_id: residentRow?.id ?? null,
    full_name: fullName ?? user.email ?? null,
    organization_id: residentRow?.organization_id ?? null,
    compound_id: residentRow?.compound_id ?? null,
    unit_id: residentRow?.unit_id ?? null,
    currency,
  };
}

export interface MobileDashboard {
  ctx: ResidentContext;
  outstanding_balance: number;
  upcoming_installment_amount: number;
  upcoming_installment_due_date: string | null;
  unpaid_utility_bills: number;
  unpaid_utility_amount: number;
  active_tickets: number;
  pending_visitors: number;
  active_orders: number;
  unread_notifications: number;
}

export async function getMobileDashboard(): Promise<MobileDashboard> {
  const ctx = await loadResidentContext();
  const supabase = await createClient();

  const empty: MobileDashboard = {
    ctx,
    outstanding_balance: 0,
    upcoming_installment_amount: 0,
    upcoming_installment_due_date: null,
    unpaid_utility_bills: 0,
    unpaid_utility_amount: 0,
    active_tickets: 0,
    pending_visitors: 0,
    active_orders: 0,
    unread_notifications: 0,
  };

  if (!ctx.resident_id) {
    // User is staff or has no resident profile — still show notifications.
    const { count: unread } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.user_id)
      .is("read_at", null);
    return { ...empty, unread_notifications: unread ?? 0 };
  }

  const [installments, utilityBills, tickets, visitors, orders, unread] = await Promise.all([
    supabase
      .from("installment_schedules")
      .select("total_due,penalty_amount,paid_amount,due_date,status,installment_contracts!inner(resident_id)")
      .eq("installment_contracts.resident_id", ctx.resident_id)
      .neq("status", "paid"),
    supabase
      .from("utility_bills")
      .select("total_amount,paid_amount,status")
      .eq("resident_id", ctx.resident_id)
      .neq("status", "paid"),
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("resident_id", ctx.resident_id)
      .in("status", ["open", "assigned", "in_progress", "pending"]),
    supabase
      .from("visitors")
      .select("id", { count: "exact", head: true })
      .eq("resident_id", ctx.resident_id)
      .in("status", ["pending", "approved"]),
    supabase
      .from("marketplace_orders")
      .select("id", { count: "exact", head: true })
      .eq("resident_id", ctx.resident_id)
      .in("order_status", ["pending", "confirmed", "assigned", "in_progress"]),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.user_id)
      .is("read_at", null),
  ]);

  type InstallmentRow = { total_due: number; penalty_amount: number; paid_amount: number; due_date: string; status: string };
  type UtilityBillRow = { total_amount: number; paid_amount: number; status: string };

  const installmentRows = (installments.data ?? []) as unknown as InstallmentRow[];
  const utilRows        = (utilityBills.data ?? []) as UtilityBillRow[];

  const remaining = (r: InstallmentRow) =>
    Math.max(0, Number(r.total_due) + Number(r.penalty_amount ?? 0) - Number(r.paid_amount));
  const outstanding = installmentRows.reduce((s, r) => s + remaining(r), 0);
  const nextDue = installmentRows
    .filter((r) => r.due_date)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const utilOutstanding = utilRows.reduce((s, r) => s + Math.max(0, Number(r.total_amount) - Number(r.paid_amount)), 0);

  return {
    ctx,
    outstanding_balance: outstanding,
    upcoming_installment_amount: nextDue ? remaining(nextDue) : 0,
    upcoming_installment_due_date: nextDue?.due_date ?? null,
    unpaid_utility_bills: utilRows.length,
    unpaid_utility_amount: utilOutstanding,
    active_tickets: tickets.count ?? 0,
    pending_visitors: visitors.count ?? 0,
    active_orders: orders.count ?? 0,
    unread_notifications: unread.count ?? 0,
  };
}

export async function getResidentContext(): Promise<ResidentContext> {
  return loadResidentContext();
}
