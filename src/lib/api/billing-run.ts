"use server";

/**
 * Auto-billing engine wrapper.
 *
 * Calls the Postgres function `generate_due_utility_bills(p_dry_run)` and
 * returns its JSONB summary. Restricted to super_admin + finance_officer.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { notifyNewBill } from "@/lib/notifications/bill-events";
import { logger } from "@/lib/logger";

export interface BillingRunDetail {
  sub_id: string;
  outcome: "generated" | "skipped_duplicate" | "error";
  provider?: string;
  bill_id?: string;
  bill_number?: string;
  period_start?: string;
  period_end?: string;
  total?: number;
  currency?: string;
  message?: string;
}

export interface BillingRunSummary {
  date: string;
  dry_run: boolean;
  generated: number;
  skipped: number;
  errors: number;
  details: BillingRunDetail[];
}

export async function runAutoBilling(dryRun: boolean): Promise<BillingRunSummary> {
  await requireRole(["super_admin", "developer_admin", "finance_officer"]);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("generate_due_utility_bills", { p_dry_run: dryRun });
  if (error) throw new Error(`generate_due_utility_bills: ${error.message}`);

  const summary = data as BillingRunSummary;

  if (!dryRun) {
    // Fire-and-forget in-app notifications for every freshly-generated bill
    for (const d of summary.details ?? []) {
      if (d.outcome === "generated" && d.bill_id) {
        notifyNewBill(d.bill_id).catch((e) => {
          logger.error("billing-run", "notifyNewBill failed", e);
        });
      }
    }

    revalidatePath("/utility-bills");
    revalidatePath("/subscriptions");
    revalidatePath("/admin/billing-run");
  }

  return summary;
}

export interface SubscriptionsDueRow {
  id: string;
  next_billing_date: string | null;
  monthly_fee: number;
  currency: string;
  subscription_type: string;
  provider_name: string | null;
  unit_number: string | null;
}

/** Preview: which subscriptions will be billed if we run today? */
export async function previewDueSubscriptions(): Promise<SubscriptionsDueRow[]> {
  await requireRole(["super_admin", "developer_admin", "finance_officer"]);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("utility_subscriptions")
    .select("id, next_billing_date, monthly_fee, currency, subscription_type, provider:utility_providers(provider_name), unit:units(unit_number)")
    .eq("status", "active")
    .not("next_billing_date", "is", null)
    .lte("next_billing_date", today)
    .order("next_billing_date");
  if (error) throw new Error(error.message);

  type RawRow = {
    id: string; next_billing_date: string | null; monthly_fee: number; currency: string;
    subscription_type: string;
    provider: { provider_name: string | null } | null;
    unit: { unit_number: string | null } | null;
  };

  return ((data ?? []) as unknown as RawRow[]).map((r) => ({
    id: r.id,
    next_billing_date: r.next_billing_date,
    monthly_fee: r.monthly_fee,
    currency: r.currency,
    subscription_type: r.subscription_type,
    provider_name: r.provider?.provider_name ?? null,
    unit_number: r.unit?.unit_number ?? null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 12 — single-bill generation with idempotency
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate ONE utility bill for a specific subscription + period via the
 * Phase 12 RPC `generate_utility_bill`. Idempotent — calling it twice for
 * the same (subscription, period_start, period_end) returns the same bill id.
 *
 * Use this for manual one-offs (e.g. "re-issue the May bill for unit A-101").
 * The bulk auto-billing flow still goes through `runAutoBilling()` above,
 * which uses the original Phase 5 batch function.
 */
export async function generateSingleUtilityBill(input: {
  subscriptionId: string;
  periodStart: string;   // YYYY-MM-DD
  periodEnd: string;     // YYYY-MM-DD
  dueDate?: string;      // YYYY-MM-DD; defaults to period_end + 14 days
  tariffId?: string;
  idempotencyKey?: string;
}): Promise<string> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("generate_utility_bill", {
    p_subscription_id: input.subscriptionId,
    p_period_start:    input.periodStart,
    p_period_end:      input.periodEnd,
    p_due_date:        input.dueDate ?? null,
    p_tariff_id:       input.tariffId ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (error) throw new Error(`generate_utility_bill: ${error.message}`);

  // Fire-and-forget notification (best-effort)
  notifyNewBill(String(data)).catch((e) => {
    logger.error("billing-run", "generateSingleUtilityBill notifyNewBill failed", e);
  });

  revalidatePath("/utility-bills");
  return String(data);
}

/**
 * Mark a utility bill paid via the Phase 12 RPC `mark_bill_as_paid`.
 * Provides strict idempotency on (bill_id, amount, gateway_payment_intent)
 * so duplicate webhook retries cannot double-charge.
 *
 * Returns the payment_id created.
 */
export async function markUtilityBillPaid(input: {
  billId: string;
  amount: number;
  paymentMethod: "cash" | "bank_transfer" | "online_payment" | "wallet" | "cheque";
  paymentMethodCode?: string;
  gatewayProvider?: string;
  gatewayPaymentIntent?: string;
  paymentReference?: string;
  idempotencyKey?: string;
}): Promise<string> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("mark_bill_as_paid", {
    p_bill_id:                input.billId,
    p_amount:                 input.amount,
    p_payment_method:         input.paymentMethod,
    p_payment_method_code:    input.paymentMethodCode ?? null,
    p_gateway_provider:       input.gatewayProvider ?? null,
    p_gateway_payment_intent: input.gatewayPaymentIntent ?? null,
    p_payment_reference:      input.paymentReference ?? null,
    p_idempotency_key:        input.idempotencyKey ?? null,
  });
  if (error) throw new Error(`mark_bill_as_paid: ${error.message}`);

  revalidatePath("/utility-bills");
  revalidatePath(`/utility-bills/${input.billId}`);
  return String(data);
}
