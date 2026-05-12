"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, requireUser } from "@/lib/auth/guards";
import {
  provisionOrganizationSchema, brandingSchema, domainSchema, orgSettingsSchema,
  planFeatureToggleSchema,
  type ProvisionOrganizationInput, type BrandingInput, type DomainInput,
  type OrgSettingsInput, type PlanFeatureToggleInput,
} from "@/lib/validations/saas";

// ─── plans ─────────────────────────────────────────────────────────────────

export interface SubscriptionPlanRow {
  id: string;
  code: string;
  name: string;
  tier: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  currency: string;
  max_compounds: number | null;
  max_units: number | null;
  max_residents: number | null;
  max_admin_users: number | null;
  max_storage_mb: number | null;
  max_api_calls_per_month: number | null;
  is_active: boolean;
  display_order: number;
}

export async function listPlans(): Promise<SubscriptionPlanRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscription_plans").select("*")
    .order("display_order").order("monthly_price");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SubscriptionPlanRow[];
}

export interface FeatureRow {
  key: string;
  name: string;
  category: string;
  description: string | null;
  is_premium: boolean;
  default_enabled: boolean;
}

export async function listFeatures(): Promise<FeatureRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_catalog").select("*").order("category").order("key");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FeatureRow[];
}

// ─── tenant provisioning (super_admin only) ────────────────────────────────

export async function provisionOrganization(input: ProvisionOrganizationInput): Promise<string> {
  await requireRole(["super_admin"]);
  const parsed = provisionOrganizationSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("provision_organization", {
    p_name: parsed.name,
    p_slug: parsed.slug,
    p_plan_code: parsed.plan_code,
    p_contact_email: parsed.contact_email ?? null,
    p_country_code: parsed.country_code ?? null,
    p_default_locale: parsed.default_locale,
    p_timezone: parsed.timezone,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/saas-console");
  revalidatePath("/organizations");
  return data as unknown as string;
}

// ─── subscriptions ────────────────────────────────────────────────────────

export interface OrgSubscriptionRow {
  id: string;
  organization_id: string;
  plan_id: string;
  plan_code: string | null;
  plan_name: string | null;
  status: string;
  billing_cycle: string;
  unit_price: number;
  currency: string;
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export async function listSubscriptions(): Promise<OrgSubscriptionRow[]> {
  await requireRole(["super_admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_subscriptions")
    .select("*, plan:subscription_plans(code,name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    organization_id: r.organization_id,
    plan_id: r.plan_id,
    plan_code: r.plan?.code ?? null,
    plan_name: r.plan?.name ?? null,
    status: r.status,
    billing_cycle: r.billing_cycle,
    unit_price: Number(r.unit_price ?? 0),
    currency: r.currency,
    trial_ends_at: r.trial_ends_at,
    current_period_start: r.current_period_start,
    current_period_end: r.current_period_end,
    cancel_at_period_end: !!r.cancel_at_period_end,
  }));
}

export async function changeSubscriptionPlan(orgId: string, planCode: string): Promise<void> {
  await requireRole(["super_admin"]);
  const supabase = await createClient();
  const { data: plan, error: pe } = await supabase
    .from("subscription_plans").select("id,monthly_price,currency").eq("code", planCode).maybeSingle();
  if (pe) throw new Error(pe.message);
  if (!plan) throw new Error(`Plan ${planCode} not found`);
  const planRow = plan as { id: string; monthly_price: number; currency: string };
  const { error } = await supabase
    .from("organization_subscriptions")
    .update({
      plan_id: planRow.id,
      unit_price: planRow.monthly_price,
      currency: planRow.currency,
      status: "active",
    })
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/saas-console");
}

// ─── branding ─────────────────────────────────────────────────────────────

export interface BrandingRow {
  organization_id: string;
  logo_path: string | null;
  logo_dark_path: string | null;
  favicon_path: string | null;
  primary_color: string;
  accent_color: string;
  background_color: string | null;
  font_family: string;
  custom_css: string | null;
  email_from_name: string | null;
  email_footer: string | null;
}

export async function getBranding(orgId: string): Promise<BrandingRow | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_branding").select("*").eq("organization_id", orgId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as BrandingRow) ?? null;
}

export async function upsertBranding(input: BrandingInput): Promise<void> {
  await requireRole(["super_admin","developer_admin","compound_manager"]);
  const parsed = brandingSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("organization_branding").upsert({
    organization_id: parsed.organization_id,
    logo_path: parsed.logo_path ?? null,
    logo_dark_path: parsed.logo_dark_path ?? null,
    favicon_path: parsed.favicon_path ?? null,
    primary_color: parsed.primary_color,
    accent_color: parsed.accent_color,
    background_color: parsed.background_color ?? null,
    font_family: parsed.font_family,
    custom_css: parsed.custom_css ?? null,
    email_from_name: parsed.email_from_name ?? null,
    email_footer: parsed.email_footer ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/settings/branding");
}

// ─── domains ──────────────────────────────────────────────────────────────

export interface DomainRow {
  id: string;
  organization_id: string;
  host: string;
  is_primary: boolean;
  ssl_status: string;
  verified_at: string | null;
  verification_token: string;
  created_at: string;
}

export async function listDomains(orgId: string): Promise<DomainRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_domains").select("*")
    .eq("organization_id", orgId).order("is_primary", { ascending: false }).order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DomainRow[];
}

export async function addDomain(input: DomainInput): Promise<void> {
  await requireRole(["super_admin","developer_admin"]);
  const parsed = domainSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("organization_domains").insert({
    organization_id: parsed.organization_id,
    host: parsed.host,
    is_primary: parsed.is_primary,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/settings/domains");
}

export async function setPrimaryDomain(domainId: string, orgId: string): Promise<void> {
  await requireRole(["super_admin","developer_admin"]);
  const supabase = await createClient();
  // Unset existing primary
  await supabase.from("organization_domains").update({ is_primary: false }).eq("organization_id", orgId);
  const { error } = await supabase.from("organization_domains").update({ is_primary: true }).eq("id", domainId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/domains");
}

export async function deleteDomain(domainId: string): Promise<void> {
  await requireRole(["super_admin","developer_admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("organization_domains").delete().eq("id", domainId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/domains");
}

// ─── settings ─────────────────────────────────────────────────────────────

export interface OrgSettingsRow {
  organization_id: string;
  default_locale: string;
  supported_locales: string[];
  timezone: string;
  date_format: string;
  number_format: string;
  rtl_enabled: boolean;
  notifications_config: Record<string, unknown>;
  feature_flags: Record<string, unknown>;
}

export async function getOrgSettings(orgId: string): Promise<OrgSettingsRow | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_settings").select("*").eq("organization_id", orgId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as OrgSettingsRow) ?? null;
}

export async function upsertOrgSettings(input: OrgSettingsInput): Promise<void> {
  await requireRole(["super_admin","developer_admin","compound_manager"]);
  const parsed = orgSettingsSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("organization_settings").upsert({
    organization_id: parsed.organization_id,
    default_locale: parsed.default_locale,
    supported_locales: parsed.supported_locales,
    timezone: parsed.timezone,
    date_format: parsed.date_format,
    rtl_enabled: parsed.rtl_enabled,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

// ─── feature overrides (super_admin) ──────────────────────────────────────

export async function setFeatureOverride(input: PlanFeatureToggleInput): Promise<void> {
  await requireRole(["super_admin"]);
  const parsed = planFeatureToggleSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("organization_feature_overrides").upsert({
    organization_id: parsed.organization_id,
    feature: parsed.feature,
    is_enabled: parsed.is_enabled,
    reason: parsed.reason ?? null,
    expires_at: parsed.expires_at ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/saas-console");
}

// ─── usage ────────────────────────────────────────────────────────────────

export interface UsageAggregateRow {
  organization_id: string;
  metric: string;
  period_date: string;
  total_amount: number;
  event_count: number;
}

export async function listUsageAggregates(orgId: string, days = 30): Promise<UsageAggregateRow[]> {
  await requireUser();
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("usage_aggregates").select("*")
    .eq("organization_id", orgId)
    .gte("period_date", since)
    .order("period_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as UsageAggregateRow[];
}

// ─── SaaS executive stats (super_admin) ───────────────────────────────────

export interface SaasOverviewStats {
  total_organizations: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  mrr_estimate: number;
  arr_estimate: number;
  unpaid_invoices: number;
  unpaid_amount: number;
  currency: string;
}

export async function getSaasOverview(): Promise<SaasOverviewStats> {
  await requireRole(["super_admin"]);
  const supabase = await createClient();
  const [orgs, subs, invs] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("organization_subscriptions").select("status,unit_price,billing_cycle,currency"),
    supabase.from("saas_invoices").select("total_amount,paid_amount,status,currency").in("status", ["open","draft"]),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subsRows = (subs.data ?? []) as any[];
  const active     = subsRows.filter((r) => r.status === "active").length;
  const trialing   = subsRows.filter((r) => r.status === "trialing").length;
  const mrr = subsRows
    .filter((r) => r.status === "active")
    .reduce((s, r) => {
      const price = Number(r.unit_price ?? 0);
      if (r.billing_cycle === "annual") return s + price / 12;
      if (r.billing_cycle === "quarterly") return s + price / 3;
      return s + price;
    }, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invRows = (invs.data ?? []) as any[];
  const unpaid_amount = invRows.reduce((s, r) => s + Math.max(0, Number(r.total_amount) - Number(r.paid_amount)), 0);
  const currency = subsRows[0]?.currency ?? invRows[0]?.currency ?? "USD";

  return {
    total_organizations: orgs.count ?? 0,
    active_subscriptions: active,
    trialing_subscriptions: trialing,
    mrr_estimate: mrr,
    arr_estimate: mrr * 12,
    unpaid_invoices: invRows.length,
    unpaid_amount,
    currency,
  };
}
