"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";

export interface SignatureRow {
  id: string;
  contract_id: string;
  resident_id: string;
  user_id: string;
  signed_at: string;
  signature_png: string;
  full_name_typed: string | null;
  template_id: string | null;
  rendered_html: string;
  ip_address: string | null;
  user_agent: string | null;
  organization_id: string;
}

/**
 * Returns the most recent signature for a contract (if any).
 * RLS lets residents see their own and staff see all org signatures.
 */
export async function getLatestSignature(contractId: string): Promise<SignatureRow | null> {
  await requireUser();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- contract_signatures missing in Database types
  const { data, error } = await (supabase as any)
    .from("contract_signatures")
    .select("*")
    .eq("contract_id", contractId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.error("contract-signatures", "latest failed", error);
    return null;
  }
  return (data as unknown as SignatureRow) ?? null;
}

interface SignContractInput {
  contractId: string;
  templateId: string;
  renderedHtml: string;
  signaturePng: string;
  fullNameTyped?: string;
}

/**
 * Resident-only: capture a signature on a contract they own.
 * Verifies ownership (resident_id linked to user_id) before inserting.
 */
export async function signContract(input: SignContractInput): Promise<SignatureRow> {
  const user = await requireUser();
  const supabase = await createClient();

  // Resolve resident row for this user
  const { data: residentRow, error: rErr } = await supabase
    .from("residents")
    .select("id, organization_id, compound_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (rErr || !residentRow) throw new Error("No resident profile found for this user");
  const resident = residentRow as { id: string; organization_id: string; compound_id: string | null };

  // Verify the contract belongs to this resident
  const { data: contractRow, error: cErr } = await supabase
    .from("installment_contracts")
    .select("id, resident_id, organization_id, compound_id")
    .eq("id", input.contractId)
    .maybeSingle();
  if (cErr || !contractRow) throw new Error("Contract not found");
  const contract = contractRow as { id: string; resident_id: string; organization_id: string; compound_id: string | null };
  if (contract.resident_id !== resident.id) throw new Error("Not your contract");

  // Validate signature is a PNG data URL
  if (!input.signaturePng.startsWith("data:image/png;base64,")) {
    throw new Error("Invalid signature format");
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent") ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- contract_signatures missing in Database types
  const { data, error } = await (supabase as any)
    .from("contract_signatures")
    .insert({
      contract_id: input.contractId,
      resident_id: resident.id,
      user_id: user.id,
      signature_png: input.signaturePng,
      full_name_typed: input.fullNameTyped ?? null,
      template_id: input.templateId,
      rendered_html: input.renderedHtml,
      ip_address: ip,
      user_agent: userAgent,
      organization_id: contract.organization_id,
      compound_id: contract.compound_id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/m/contracts/${input.contractId}`);
  revalidatePath(`/contracts/${input.contractId}`);
  return data as unknown as SignatureRow;
}

/**
 * Returns counts of signed vs unsigned contracts for the current resident.
 * Used by the mobile contracts index to show a badge.
 */
export async function listResidentContracts(): Promise<Array<{
  id: string;
  contract_number: string;
  contract_type: string;
  contract_status: string;
  total_property_price: number | null;
  monthly_amount: number | null;
  currency: string | null;
  is_signed: boolean;
}>> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: resident } = await supabase
    .from("residents")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  const residentId = (resident as { id?: string } | null)?.id;
  if (!residentId) return [];

  const { data: contracts, error } = await supabase
    .from("installment_contracts")
    .select("id, contract_number, contract_type, contract_status, total_property_price, monthly_amount, currency")
    .eq("resident_id", residentId)
    .order("created_at", { ascending: false });
  if (error) {
    logger.error("contract-signatures", "list resident contracts failed", error);
    return [];
  }
  const list = (contracts ?? []) as Array<{ id: string; contract_number: string; contract_type: string; contract_status: string; total_property_price: number | null; monthly_amount: number | null; currency: string | null }>;
  if (list.length === 0) return [];

  // Bulk-fetch signature presence
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- contract_signatures missing in Database types
  const { data: sigs } = await (supabase as any)
    .from("contract_signatures")
    .select("contract_id")
    .in("contract_id", list.map((c) => c.id));
  const signedSet = new Set(((sigs ?? []) as Array<{ contract_id: string }>).map((s) => s.contract_id));

  return list.map((c) => ({ ...c, is_signed: signedSet.has(c.id) }));
}
