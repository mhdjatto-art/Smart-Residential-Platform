"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { paymentSchema, type PaymentInput } from "@/lib/validations/contract";

export interface PaymentRow {
  id: string;
  organization_id: string;
  compound_id: string;
  contract_id: string;
  resident_id: string;
  payment_reference: string;
  payment_date: string;
  payment_method: string;
  payment_amount: number;
  payment_status: string;
  currency: string | null;
  notes: string | null;
  external_reference: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  created_at: string;
}

interface ListOpts {
  contractId?: string;
  status?: string;
  method?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listPaymentsPaged(opts: ListOpts = {}): Promise<{ data: PaymentRow[]; total: number }> {
  await requireUser();
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 25);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from("payments").select("*", { count: "exact" }).order("payment_date", { ascending: false }).range(from, to);
  if (opts.contractId) q = q.eq("contract_id", opts.contractId);
  if (opts.status && opts.status !== "all") q = q.eq("payment_status", opts.status);
  if (opts.method && opts.method !== "all") q = q.eq("payment_method", opts.method);
  if (opts.search?.trim()) q = q.ilike("payment_reference", `%${opts.search.trim()}%`);

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return { data: (data ?? []) as unknown as PaymentRow[], total: count ?? 0 };
}

export async function getPayment(id: string): Promise<PaymentRow | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as PaymentRow) ?? null;
}

export async function recordPayment(input: PaymentInput): Promise<string> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const parsed = paymentSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("record_payment", {
    p_contract_id: parsed.contract_id,
    p_amount: parsed.amount,
    p_payment_method: parsed.payment_method,
    p_payment_date: parsed.payment_date,
    p_external_ref: parsed.external_reference ?? null,
    p_notes: parsed.notes ?? null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/payments");
  revalidatePath(`/contracts/${parsed.contract_id}`);
  return String(data);
}

export async function reversePayment(paymentId: string, reason: string): Promise<void> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  if (!reason || reason.trim().length < 3) throw new Error("Reversal reason required");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_payment", {
    p_payment_id: paymentId,
    p_reason: reason.trim(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/payments");
  revalidatePath(`/payments/${paymentId}`);
}

export interface ReceiptRow {
  id: string;
  payment_id: string;
  receipt_number: string;
  issued_at: string;
}

export async function getReceiptForPayment(paymentId: string): Promise<ReceiptRow | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("receipts").select("*").eq("payment_id", paymentId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as ReceiptRow) ?? null;
}

export interface AllocationRow {
  id: string;
  payment_id: string;
  installment_id: string;
  amount: number;
  applied_to: string;
}

export async function listAllocations(paymentId: string): Promise<AllocationRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_allocations")
    .select("*")
    .eq("payment_id", paymentId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AllocationRow[];
}
