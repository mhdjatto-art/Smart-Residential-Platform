"use server";

/**
 * Receipt data loader.
 *
 * Fetches everything needed for a receipt in one round-trip and verifies
 * the caller is allowed to view it (the bill's resident, the unit's
 * resident, or staff).
 */

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";

export interface ReceiptData {
  bill: {
    id: string;
    bill_number: string;
    utility_type: string;
    billing_period_start: string;
    billing_period_end: string;
    due_date: string;
    subtotal: number;
    tax_amount: number;
    penalty_amount: number;
    total_amount: number;
    paid_amount: number;
    currency: string;
    status: string;
    paid_at: string | null;
    metadata: Record<string, unknown> | null;
  };
  resident: {
    full_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  unit: {
    unit_number: string;
    building_name: string | null;
  } | null;
  provider: {
    provider_name: string;
    adapter_kind: string | null;
  } | null;
  organization: {
    name: string;
    contact_email: string | null;
    contact_phone: string | null;
  };
  compound: {
    name: string;
    city: string | null;
  } | null;
}

export async function getReceipt(billId: string): Promise<ReceiptData | null> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("utility_bills")
    .select(`
      id, bill_number, utility_type, billing_period_start, billing_period_end, due_date,
      subtotal, tax_amount, penalty_amount, total_amount, paid_amount, currency, status, paid_at, metadata,
      organization_id, resident_id, unit_id,
      unit:units(unit_number, building:buildings(name)),
      provider:utility_providers(provider_name, adapter_kind),
      resident:residents(first_name, last_name, email, phone),
      compound:compounds(name, city)
    `)
    .eq("id", billId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  type Raw = {
    id: string; bill_number: string; utility_type: string;
    billing_period_start: string; billing_period_end: string; due_date: string;
    subtotal: number; tax_amount: number; penalty_amount: number;
    total_amount: number; paid_amount: number; currency: string;
    status: string; paid_at: string | null;
    metadata: Record<string, unknown> | null;
    organization_id: string;
    resident_id: string | null;
    unit_id: string | null;
    unit: { unit_number: string | null; building: { name: string | null } | null } | null;
    provider: { provider_name: string | null; adapter_kind: string | null } | null;
    resident: { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
    compound: { name: string | null; city: string | null } | null;
  };
  const r = data as unknown as Raw;

  // Ownership check (residents see only their own; staff sees all)
  const isStaff = user.isSuperAdmin || user.roles.some((role) =>
    ["developer_admin", "compound_manager", "finance_officer"].includes(role.role));
  if (!isStaff) {
    const { data: mine } = await supabase
      .from("residents").select("id, unit_id").eq("user_id", user.id);
    const myResidentIds = ((mine ?? []) as Array<{ id: string; unit_id: string | null }>).map((x) => x.id);
    const myUnitIds     = ((mine ?? []) as Array<{ id: string; unit_id: string | null }>).map((x) => x.unit_id).filter(Boolean) as string[];
    const isMine =
      (r.resident_id && myResidentIds.includes(r.resident_id)) ||
      (!r.resident_id && r.unit_id && myUnitIds.includes(r.unit_id));
    if (!isMine) return null;
  }

  // Fetch the organization in a second query (RLS-safe)
  const { data: org } = await supabase
    .from("organizations")
    .select("name, contact_email, contact_phone")
    .eq("id", r.organization_id)
    .maybeSingle();

  const full_name = r.resident
    ? [r.resident.first_name, r.resident.last_name].filter(Boolean).join(" ") || "Resident"
    : null;

  return {
    bill: {
      id: r.id,
      bill_number: r.bill_number,
      utility_type: r.utility_type,
      billing_period_start: r.billing_period_start,
      billing_period_end: r.billing_period_end,
      due_date: r.due_date,
      subtotal: r.subtotal,
      tax_amount: r.tax_amount,
      penalty_amount: r.penalty_amount,
      total_amount: r.total_amount,
      paid_amount: r.paid_amount,
      currency: r.currency,
      status: r.status,
      paid_at: r.paid_at,
      metadata: r.metadata,
    },
    resident: r.resident && full_name ? {
      full_name,
      email: r.resident.email,
      phone: r.resident.phone,
    } : null,
    unit: r.unit?.unit_number ? {
      unit_number: r.unit.unit_number,
      building_name: r.unit.building?.name ?? null,
    } : null,
    provider: r.provider?.provider_name ? {
      provider_name: r.provider.provider_name,
      adapter_kind: r.provider.adapter_kind,
    } : null,
    organization: {
      name: (org as { name?: string } | null)?.name ?? "Organization",
      contact_email: (org as { contact_email?: string | null } | null)?.contact_email ?? null,
      contact_phone: (org as { contact_phone?: string | null } | null)?.contact_phone ?? null,
    },
    compound: r.compound?.name ? {
      name: r.compound.name,
      city: r.compound.city ?? null,
    } : null,
  };
}

/** Lists every paid bill for the current resident (used by /m/payments/history). */
export async function listMyPaidBills(): Promise<Array<{
  id: string;
  bill_number: string;
  utility_type: string;
  total_amount: number;
  currency: string;
  paid_at: string | null;
  provider_name: string | null;
}>> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("residents").select("id, unit_id").eq("user_id", user.id);

  const residentIds = ((mine ?? []) as Array<{ id: string; unit_id: string | null }>).map((x) => x.id);
  const unitIds     = ((mine ?? []) as Array<{ id: string; unit_id: string | null }>).map((x) => x.unit_id).filter(Boolean) as string[];
  if (residentIds.length === 0 && unitIds.length === 0) return [];

  const q = supabase
    .from("utility_bills")
    .select("id, bill_number, utility_type, total_amount, currency, paid_at, provider:utility_providers(provider_name)")
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(50);

  if (residentIds.length > 0 && unitIds.length > 0) {
    q.or(`resident_id.in.(${residentIds.join(",")}),unit_id.in.(${unitIds.join(",")})`);
  } else if (residentIds.length > 0) {
    q.in("resident_id", residentIds);
  } else {
    q.in("unit_id", unitIds);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  type Raw = {
    id: string; bill_number: string; utility_type: string;
    total_amount: number; currency: string; paid_at: string | null;
    provider: { provider_name: string | null } | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    bill_number: r.bill_number,
    utility_type: r.utility_type,
    total_amount: r.total_amount,
    currency: r.currency,
    paid_at: r.paid_at,
    provider_name: r.provider?.provider_name ?? null,
  }));
}
