"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { notifyPenaltyApplied } from "@/lib/notifications/bill-events";

export interface PaymentInput {
  bill_id: string;
  amount: number;
  method: "cash" | "bank_transfer" | "online_payment" | "wallet" | "cheque";
  reference?: string;
  notes?: string;
}

export async function payUtilityBill(input: PaymentInput): Promise<void> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("record_utility_bill_payment", {
    p_bill_id:   input.bill_id,
    p_amount:    input.amount,
    p_method:    input.method,
    p_reference: input.reference ?? null,
    p_notes:     input.notes ?? null,
  });
  if (error) throw new Error(`record_utility_bill_payment: ${error.message}`);
  revalidatePath("/utility-bills");
}

export interface PenaltyRunSummary {
  applied: number;
  total_penalty: number;
  rate: number;
  grace_days: number;
  details: Array<{
    bill_id: string;
    bill_number: string;
    days_overdue: number;
    penalty: number;
  }>;
}

export async function applyUtilityPenalties(
  rate: number = 0.02,
  graceDays: number = 7,
): Promise<PenaltyRunSummary> {
  await requireRole(["super_admin", "developer_admin", "finance_officer"]);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("apply_utility_bill_penalties_all", {
    p_rate:       rate,
    p_grace_days: graceDays,
  });
  if (error) throw new Error(`apply_utility_bill_penalties_all: ${error.message}`);

  const summary = data as PenaltyRunSummary;
  // Fire-and-forget in-app notifications for every bill that got a penalty
  for (const d of summary.details ?? []) {
    notifyPenaltyApplied(d.bill_id, d.penalty).catch((e) => {
      console.error("[apply-penalties] notifyPenaltyApplied failed:", e instanceof Error ? e.message : String(e));
    });
  }

  revalidatePath("/utility-bills");
  return summary;
}
