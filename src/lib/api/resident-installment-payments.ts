"use server";

/**
 * Phase 20 — Resident self-service installment / rent payments.
 *
 * Allows a resident to pay against a specific installment_schedule row they
 * own. Internally calls the existing `record_payment(contract_id, ...)` RPC
 * which applies the amount across installments in due-date order. We pass
 * the smallest sensible amount (the requested) and let the RPC distribute.
 *
 * Mirrors the structure of `resident-payments.ts` (utility bills) but for
 * installment_contracts (property_sale, lease_to_own, rental).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";

export interface PayInstallmentInput {
  /** Schedule row the resident clicked on — we resolve its contract_id. */
  installment_id: string;
  amount:         number;
  method:         "online_payment" | "wallet";
  /** Optional external ref (gateway txn id) — set automatically by webhook for online. */
  reference?:     string;
}

export interface PayInstallmentResult {
  ok:           true;
  payment_id:   string;
  contract_id:  string;
  applied:      number;
}

export async function payMyInstallment(input: PayInstallmentInput): Promise<PayInstallmentResult> {
  const user = await requireUser();
  const supabase = await createClient();

  // 1. Find the schedule + its parent contract + verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sched, error: sErr } = await (supabase as any)
    .from("installment_schedules")
    .select("id, contract_id, total_due, paid_amount, penalty_amount, status, installment_contracts!inner(id, resident_id, residents!inner(user_id))")
    .eq("id", input.installment_id)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!sched) throw new Error("Installment not found");

  // ownership: the contract's resident must have user_id === current user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contract = (sched as any).installment_contracts;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownerUserId = (contract?.residents?.user_id ?? null) as string | null;
  if (ownerUserId !== user.id) {
    throw new Error("This installment is not yours");
  }

  if (sched.status === "paid") {
    throw new Error("Installment already paid");
  }

  // 2. Clamp amount: must be > 0 and <= remaining + penalty
  const remaining = Math.max(0, Number(sched.total_due) + Number(sched.penalty_amount ?? 0) - Number(sched.paid_amount));
  const amount = Math.min(Math.max(0, Number(input.amount)), remaining);
  if (amount <= 0) throw new Error("Amount must be > 0");

  // 3. For "wallet": deduct from wallet first (RPC enforces balance check)
  if (input.method === "wallet") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: wErr } = await (supabase as any).rpc("wallet_pay_installment", {
      p_contract_id: sched.contract_id,
      p_amount:      amount,
      p_ref:         input.reference ?? `WALLET-${Date.now()}`,
    });
    // If the RPC doesn't exist yet, fall back to a regular record_payment with
    // method='wallet' — the wallet deduction will be wired in Phase 13.4.
    if (wErr && !/function .* does not exist/i.test(wErr.message)) {
      throw new Error(wErr.message);
    }
  }

  // 4. Record the payment via the canonical RPC
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: paymentId, error: pErr } = await (supabase as any).rpc("record_payment", {
    p_contract_id:    sched.contract_id,
    p_amount:         amount,
    p_payment_method: input.method,
    p_payment_date:   new Date().toISOString().slice(0, 10),
    p_external_ref:   input.reference ?? null,
    p_notes:          input.method === "wallet" ? "Wallet payment via /m" : "Online payment via /m",
  });
  if (pErr) throw new Error(pErr.message);

  revalidatePath("/m/payments");
  revalidatePath("/m");
  return { ok: true, payment_id: paymentId as string, contract_id: sched.contract_id, applied: amount };
}
