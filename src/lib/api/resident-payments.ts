"use server";

/**
 * Resident self-service payment actions.
 *
 * Unlike the admin payment action in utility-bill-actions.ts, these:
 *   - Verify the caller IS the resident on the bill (or the unit's resident)
 *   - Restrict payment methods to online/wallet (residents don't hand cash)
 *   - Are callable by users with `resident` role
 *
 * The actual money movement (Stripe / PayPal / local gateway) happens
 * elsewhere — here we just record the payment as confirmed once the
 * gateway webhook lands. For now, the mobile UI calls this directly with
 * method='online_payment' and a placeholder reference.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";

export interface ResidentPayInput {
  bill_id: string;
  amount: number;
  method: "online_payment" | "wallet";
  reference?: string;
}

export async function payMyUtilityBill(input: ResidentPayInput): Promise<{ ok: true }> {
  const user = await requireUser();
  const supabase = await createClient();

  // 1. Fetch the bill and find the resident that should own it
  const { data: bill, error: bErr } = await supabase
    .from("utility_bills")
    .select("id, resident_id, unit_id, status, total_amount, penalty_amount, paid_amount")
    .eq("id", input.bill_id)
    .maybeSingle();
  if (bErr) throw new Error(bErr.message);
  if (!bill) throw new Error("Bill not found");

  const b = bill as {
    id: string; resident_id: string | null; unit_id: string | null; status: string;
    total_amount: number; penalty_amount: number; paid_amount: number;
  };

  // 2. Resolve which residents the caller is — match against bill.resident_id
  //    OR (when bill.resident_id is null) bill.unit_id ↔ a resident.unit_id.
  const { data: myResidents } = await supabase
    .from("residents")
    .select("id, unit_id")
    .eq("user_id", user.id);

  const myResidentIds = ((myResidents ?? []) as Array<{ id: string; unit_id: string | null }>).map((r) => r.id);
  const myUnitIds     = ((myResidents ?? []) as Array<{ id: string; unit_id: string | null }>).map((r) => r.unit_id).filter(Boolean);

  const isMine =
    (b.resident_id && myResidentIds.includes(b.resident_id)) ||
    (!b.resident_id && b.unit_id && (myUnitIds as string[]).includes(b.unit_id));

  if (!isMine) {
    // Allow staff to also use this path (delegated payments)
    const isStaff = user.isSuperAdmin || user.roles.some((r) =>
      ["developer_admin","compound_manager","finance_officer"].includes(r.role));
    if (!isStaff) throw new Error("You can only pay your own bills");
  }

  // 3. Guard rails
  if (b.status === "cancelled") throw new Error("Bill is cancelled");
  if (input.amount <= 0) throw new Error("Amount must be > 0");
  const owed = Math.max(0, Number(b.total_amount) + Number(b.penalty_amount ?? 0) - Number(b.paid_amount ?? 0));
  if (input.amount > owed + 0.01) throw new Error(`Cannot pay more than ${owed.toFixed(2)}`);

  // 4. Record via the SQL function (same one admins use)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("record_utility_bill_payment", {
    p_bill_id:   input.bill_id,
    p_amount:    input.amount,
    p_method:    input.method,
    p_reference: input.reference ?? `SELF-${Date.now().toString(36).toUpperCase()}`,
    p_notes:     "Paid by resident via mobile portal",
  });
  if (error) throw new Error(`record_utility_bill_payment: ${error.message}`);

  revalidatePath("/m");
  revalidatePath("/m/payments");
  revalidatePath("/m/utilities");
  return { ok: true };
}
