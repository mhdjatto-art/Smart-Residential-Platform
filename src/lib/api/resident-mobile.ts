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
import { withTimeout } from "@/lib/promise-timeout";
import { logger } from "@/lib/logger";

export type TenancyType = "owner" | "tenant" | "family_member" | "guest";

export interface ResidentContext {
  user_id: string;
  resident_id: string | null;
  full_name: string | null;
  organization_id: string | null;
  compound_id: string | null;
  unit_id: string | null;
  currency: string;
  /** owner | tenant | family_member | guest — drives which payment flows show */
  tenancy_type: TenancyType | null;
}

async function loadResidentContext(): Promise<ResidentContext> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("residents")
    .select("id,first_name,last_name,organization_id,compound_id,unit_id,tenancy_type")
    .eq("user_id", user.id)
    .maybeSingle();
  const residentRow = r as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    organization_id: string;
    compound_id: string | null;
    unit_id: string | null;
    tenancy_type: TenancyType | null;
  } | null;
  const fullName = residentRow
    ? [residentRow.first_name, residentRow.last_name].filter(Boolean).join(" ") || null
    : null;
  let currency = "IQD";
  if (residentRow?.organization_id) {
    const { data: org } = await supabase.from("organizations").select("currency").eq("id", residentRow.organization_id).maybeSingle();
    currency = (org as { currency?: string } | null)?.currency ?? "IQD";
  }
  return {
    user_id: user.id,
    resident_id: residentRow?.id ?? null,
    full_name: fullName ?? user.email ?? null,
    organization_id: residentRow?.organization_id ?? null,
    compound_id: residentRow?.compound_id ?? null,
    unit_id: residentRow?.unit_id ?? null,
    currency,
    tenancy_type: residentRow?.tenancy_type ?? null,
  };
}

export interface MobileDashboard {
  ctx: ResidentContext;
  /**
   * Total outstanding across the resident's primary obligation:
   * - owner with installments → sum of remaining installments
   * - tenant with rental contract → sum of unpaid rent invoices
   * - else → 0 (utility bills are tracked separately below)
   */
  outstanding_balance: number;
  /** Discriminator so the UI knows which kind of obligation outstanding_balance represents */
  primary_obligation: "installments" | "rent" | "none";
  /** Next-due amount + date for that obligation */
  upcoming_installment_amount: number;
  upcoming_installment_due_date: string | null;
  /** True if the resident has any installment_contract attached to them */
  has_installments: boolean;
  /** True if the resident has any active rental contract */
  has_rental: boolean;
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
    primary_obligation: "none",
    upcoming_installment_amount: 0,
    upcoming_installment_due_date: null,
    has_installments: false,
    has_rental: false,
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

  // Owners see installment schedules (cash sales have no installments → empty)
  // Tenants see rent payment schedules (rental contracts may also use the same
  // installment_schedules table, indexed by contract_type=rental).
  const [installments, rentalContracts, utilityBills, tickets, visitors, orders, unread] = await withTimeout(Promise.all([
    // Installments tied to a property_sale or lease_to_own contract for this resident
    supabase
      .from("installment_schedules")
      .select("total_due,penalty_amount,paid_amount,due_date,status,installment_contracts!inner(resident_id,contract_type)")
      .eq("installment_contracts.resident_id", ctx.resident_id)
      .neq("status", "paid"),
    // Active rental contracts for this resident (used to detect rent-bearing tenants)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("installment_contracts")
      .select("id,contract_type,monthly_amount,contract_status")
      .eq("resident_id", ctx.resident_id)
      .eq("contract_type", "rental")
      .neq("contract_status", "terminated"),
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
  ]), 5000, "getMobileDashboard.parallelQueries").catch((e) => {
    // Timeout → degrade gracefully instead of crashing the whole page.
    logger.error("resident-mobile", "parallel queries timed out, returning empty", e);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const empty = { data: [], count: 0, error: null } as any;
    return [empty, empty, empty, empty, empty, empty, empty] as const;
  });

  type InstallmentRow = { total_due: number; penalty_amount: number; paid_amount: number; due_date: string; status: string;
    installment_contracts?: { contract_type?: string } | { contract_type?: string }[] };
  type UtilityBillRow = { total_amount: number; paid_amount: number; status: string };

  const installmentRows = (installments.data ?? []) as unknown as InstallmentRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rentalRows      = (rentalContracts.data ?? []) as Array<{ id: string; contract_type: string; monthly_amount: number; contract_status: string }>;
  const utilRows        = (utilityBills.data ?? []) as UtilityBillRow[];

  const remaining = (r: InstallmentRow) =>
    Math.max(0, Number(r.total_due) + Number(r.penalty_amount ?? 0) - Number(r.paid_amount));

  // Split the installment_schedules rows by contract_type so we can distinguish
  // property-sale installments from rental payment schedules.
  const ctypeOf = (r: InstallmentRow): string | undefined => {
    const c = r.installment_contracts;
    if (!c) return undefined;
    if (Array.isArray(c)) return c[0]?.contract_type;
    return c.contract_type;
  };
  const propInstallments = installmentRows.filter((r) => {
    const t = ctypeOf(r);
    return t === "property_sale" || t === "lease_to_own";
  });
  const rentInstallments = installmentRows.filter((r) => ctypeOf(r) === "rental");

  const isOwner   = ctx.tenancy_type === "owner";
  const hasInst   = propInstallments.length > 0;
  // Tenant rent counts if either there's a rental contract OR there are
  // rent-typed installment rows
  const hasRental = rentalRows.length > 0 || rentInstallments.length > 0;

  // Primary obligation: what the hero card shows.
  // Owner with property installments → installments.
  // Tenant with rent → rent.
  // Else (cash-paid owner, off-platform tenant) → none.
  let primary: "installments" | "rent" | "none" = "none";
  let primaryRows: InstallmentRow[] = [];
  if (isOwner && hasInst) {
    primary = "installments";
    primaryRows = propInstallments;
  } else if (!isOwner && hasRental) {
    primary = "rent";
    primaryRows = rentInstallments;
  }

  const outstanding = primaryRows.reduce((s, r) => s + remaining(r), 0);
  const nextDue = primaryRows
    .filter((r) => r.due_date)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const utilOutstanding = utilRows.reduce((s, r) => s + Math.max(0, Number(r.total_amount) - Number(r.paid_amount)), 0);

  return {
    ctx,
    outstanding_balance: outstanding,
    primary_obligation: primary,
    upcoming_installment_amount: nextDue ? remaining(nextDue) : 0,
    upcoming_installment_due_date: nextDue?.due_date ?? null,
    has_installments: hasInst,
    has_rental: hasRental,
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
