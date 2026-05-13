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
          console.error("[billing-run] notifyNewBill failed:", e instanceof Error ? e.message : String(e));
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
