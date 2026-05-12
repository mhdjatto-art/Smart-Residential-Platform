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
      tiers: parsed.tiers,
      formula: parsed.formula ?? null,
      schedule: parsed.schedule,
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
    p_unit_id: args.unit_id ?? null,
    p_consumption: args.consumption ?? 0,
    p_residents: args.residents ?? null,
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
}

export async function listIntegrations(): Promise<IntegrationRow[]> {
  await requireRole(["super_admin","developer_admin","compound_manager"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provider_integrations").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as IntegrationRow[];
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
      config: parsed.config,
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
