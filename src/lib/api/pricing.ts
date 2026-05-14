"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, requireUser } from "@/lib/auth/guards";
import {
  pricingRuleSchema, integrationSchema,
  type PricingRuleInput, type IntegrationInput,
} from "@/lib/validations/pricing";

// ─── Pricing rules ────────────────────────────────────────────────────────

export interface PricingRuleRow {
  id: string;
  organization_id: string;
  compound_id: string | null;
  name: string;
  service_kind: string;
  method: string;
  base_amount: number;
  unit_amount: number;
  min_amount: number | null;
  max_amount: number | null;
  currency: string;
  tiers: unknown;
  formula: string | null;
  schedule: unknown;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
  priority: number;
  notes: string | null;
  created_at: string;
}

export async function listPricingRules(): Promise<PricingRuleRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_pricing_rules").select("*")
    .order("service_kind").order("priority").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PricingRuleRow[];
}

export async function createPricingRule(input: PricingRuleInput): Promise<PricingRuleRow> {
  const user = await requireRole(["super_admin","developer_admin","compound_manager","finance_officer"]);
  const parsed = pricingRuleSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_pricing_rules")
    .insert({
      organization_id: parsed.organization_id,
      compound_id: parsed.compound_id ?? null,
      name: parsed.name,
      service_kind: parsed.service_kind,
      method: parsed.method,
      base_amount: parsed.base_amount,
      unit_amount: parsed.unit_amount,
      min_amount: parsed.min_amount ?? null,
      max_amount: parsed.max_amount ?? null,
      currency: parsed.currency,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Record<string,unknown> not assignable to Json
      tiers: parsed.tiers as any,
      formula: parsed.formula ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Record<string,unknown> not assignable to Json
      schedule: parsed.schedule as any,
      is_active: parsed.is_active,
      effective_from: parsed.effective_from,
      effective_to: parsed.effective_to ?? null,
      priority: parsed.priority,
      notes: parsed.notes ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*").single();
  if (error) throw new Error(error.message);
  revalidatePath("/pricing-rules");
  return data as unknown as PricingRuleRow;
}

export async function deletePricingRule(id: string): Promise<void> {
  await requireRole(["super_admin","developer_admin","compound_manager"]);
  const supabase = await createClient();
  const { error } = await supabase.from("service_pricing_rules").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pricing-rules");
}

export async function previewFee(args: {
  org_id: string; service_kind: string; unit_id?: string;
  consumption?: number; residents?: number; when_at?: string;
}): Promise<number> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("compute_dynamic_fee", {
    p_org_id: args.org_id,
    p_service_kind: args.service_kind,
    p_unit_id: args.unit_id ?? undefined,
    p_consumption: args.consumption ?? 0,
    p_residents: args.residents ?? undefined,
    p_when_at: args.when_at ?? new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

// ─── Integrations ─────────────────────────────────────────────────────────

export interface IntegrationRow {
  id: string;
  organization_id: string;
  provider_id: string | null;
  adapter_kind: string;
  name: string;
  endpoint_url: string | null;
  config: Record<string, unknown>;
  status: string;
  last_synced_at: string | null;
  last_error: string | null;
  is_active: boolean;
  // Joined from utility_providers
  provider_name: string | null;
  provider_type: string | null;
  provider_country: string | null;
  provider_category: string | null;
}

export async function listIntegrations(): Promise<IntegrationRow[]> {
  await requireRole(["super_admin","developer_admin","compound_manager"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provider_integrations")
    .select("*, provider:utility_providers(provider_name,provider_type,metadata)")
    .order("name");
  if (error) throw new Error(error.message);

  type RawRow = {
    id: string; organization_id: string; provider_id: string | null;
    adapter_kind: string; name: string; endpoint_url: string | null;
    config: Record<string, unknown>; status: string;
    last_synced_at: string | null; last_error: string | null; is_active: boolean;
    provider: {
      provider_name: string | null;
      provider_type: string | null;
      metadata: Record<string, unknown> | null;
    } | null;
  };

  return ((data ?? []) as unknown as RawRow[]).map((r) => {
    const md = (r.provider?.metadata ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      organization_id: r.organization_id,
      provider_id: r.provider_id,
      adapter_kind: r.adapter_kind,
      name: r.name,
      endpoint_url: r.endpoint_url,
      config: r.config,
      status: r.status,
      last_synced_at: r.last_synced_at,
      last_error: r.last_error,
      is_active: r.is_active,
      provider_name:     r.provider?.provider_name ?? null,
      provider_type:     r.provider?.provider_type ?? null,
      provider_country:  typeof md.country === "string"  ? md.country  : null,
      provider_category: typeof md.category === "string" ? md.category : null,
    };
  });
}

export async function createIntegration(input: IntegrationInput): Promise<IntegrationRow> {
  await requireRole(["super_admin","developer_admin"]);
  const parsed = integrationSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provider_integrations")
    .insert({
      organization_id: parsed.organization_id,
      provider_id: parsed.provider_id ?? null,
      adapter_kind: parsed.adapter_kind,
      name: parsed.name,
      endpoint_url: parsed.endpoint_url ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Record<string,unknown> not assignable to Json
      config: parsed.config as any,
      status: parsed.status,
      is_active: parsed.is_active,
      health_check_url: parsed.health_check_url ?? null,
    })
    .select("*").single();
  if (error) throw new Error(error.message);
  revalidatePath("/integrations");
  return data as unknown as IntegrationRow;
}

export interface IntegrationLogRow {
  id: number;
  organization_id: string | null;
  integration_id: string | null;
  action: string;
  outcome: string;
  status_code: number | null;
  duration_ms: number | null;
  error_message: string | null;
  occurred_at: string;
}

export async function listIntegrationLogs(integrationId?: string): Promise<IntegrationLogRow[]> {
  await requireRole(["super_admin","developer_admin","compound_manager"]);
  const supabase = await createClient();
  let q = supabase.from("integration_logs").select("*").order("occurred_at", { ascending: false }).limit(200);
  if (integrationId) q = q.eq("integration_id", integrationId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as IntegrationLogRow[];
}
