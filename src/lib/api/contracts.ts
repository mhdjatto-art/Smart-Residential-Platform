"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { contractSchema, type ContractInput } from "@/lib/validations/contract";

export interface ContractRow {
  id: string;
  organization_id: string;
  compound_id: string;
  unit_id: string;
  resident_id: string;
  contract_number: string;
  contract_type: string;
  contract_status: string;
  contract_start_date: string;
  contract_end_date: string | null;
  currency: string | null;
  total_property_price: number;
  down_payment: number;
  financed_amount: number;
  installment_frequency: string;
  installment_count: number;
  monthly_amount: number | null;
  annual_interest_rate: number;
  late_penalty_type: string | null;
  late_penalty_value: number | null;
  grace_period_days: number;
  notes: string | null;
  created_at: string;
}

interface ListOpts {
  status?: string;
  contractType?: string;
  compoundId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listContractsPaged(opts: ListOpts = {}): Promise<{ data: ContractRow[]; total: number }> {
  await requireUser();
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 25);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from("installment_contracts").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (opts.status && opts.status !== "all") q = q.eq("contract_status", opts.status);
  if (opts.contractType && opts.contractType !== "all") q = q.eq("contract_type", opts.contractType);
  if (opts.compoundId) q = q.eq("compound_id", opts.compoundId);
  if (opts.search?.trim()) q = q.ilike("contract_number", `%${opts.search.trim()}%`);

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return { data: (data ?? []) as unknown as ContractRow[], total: count ?? 0 };
}

export async function getContract(id: string): Promise<ContractRow | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("installment_contracts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as ContractRow) ?? null;
}

export async function createContract(input: ContractInput): Promise<ContractRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const parsed = contractSchema.parse(input);
  const supabase = await createClient();

  // Resolve tenant scope from the unit.
  const { data: unit, error: uErr } = await supabase
    .from("units")
    .select("*")
    .eq("id", parsed.unit_id)
    .single();
  if (uErr || !unit) throw new Error("Unit not found");
  const u = unit as { organization_id: string; compound_id: string };

  const { data, error } = await supabase
    .from("installment_contracts")
    .insert({
      organization_id: u.organization_id,
      compound_id: u.compound_id,
      unit_id: parsed.unit_id,
      resident_id: parsed.resident_id,
      contract_number: parsed.contract_number,
      contract_type: parsed.contract_type,
      currency: parsed.currency,
      contract_start_date: parsed.contract_start_date,
      contract_end_date: parsed.contract_end_date ?? null,
      total_property_price: parsed.total_property_price,
      down_payment: parsed.down_payment,
      installment_frequency: parsed.installment_frequency,
      installment_count: parsed.installment_count,
      annual_interest_rate: parsed.annual_interest_rate,
      late_penalty_type: parsed.late_penalty_type ?? null,
      late_penalty_value: parsed.late_penalty_value ?? null,
      grace_period_days: parsed.grace_period_days,
      notes: parsed.notes ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/contracts");
  return data as unknown as ContractRow;
}

export async function generateSchedule(contractId: string): Promise<number> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_installment_schedule", { p_contract_id: contractId });
  if (error) throw new Error(error.message);
  revalidatePath(`/contracts/${contractId}`);
  return Number(data) || 0;
}

export async function activateContract(contractId: string): Promise<void> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("activate_contract", { p_contract_id: contractId });
  if (error) throw new Error(error.message);
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
}

export async function applyPenalties(contractId: string): Promise<number> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_penalties_for_contract", { p_contract_id: contractId });
  if (error) throw new Error(error.message);
  revalidatePath(`/contracts/${contractId}`);
  return Number(data) || 0;
}

export interface ScheduleRow {
  id: string;
  contract_id: string;
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_due: number;
  penalty_amount: number;
  paid_amount: number;
  status: string;
  paid_at: string | null;
}

export async function listSchedule(contractId: string): Promise<ScheduleRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("installment_schedules")
    .select("*")
    .eq("contract_id", contractId)
    .order("installment_number");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ScheduleRow[];
}
