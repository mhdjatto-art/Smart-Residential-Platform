"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";
import {
  providerSchema, internetPackageSchema, subscriptionSchema,
  meterSchema, readingSchema, tariffSchema, gasOrderSchema,
  type ProviderInput, type InternetPackageInput, type SubscriptionInput,
  type MeterInput, type ReadingInput, type TariffInput, type GasOrderInput,
} from "@/lib/validations/utilities";

// ─── Providers ────────────────────────────────────────────────────────────

export interface ProviderRow {
  id: string;
  organization_id: string;
  compound_id: string | null;
  provider_name: string;
  provider_type: string;
  provider_code: string | null;
  billing_method: string;
  tariff_type: string;
  provider_status: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  adapter_kind: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function listProviders(): Promise<ProviderRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("utility_providers").select("*").order("provider_name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProviderRow[];
}

export async function getProvider(id: string): Promise<ProviderRow | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("utility_providers").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as ProviderRow) ?? null;
}

export async function createProvider(input: ProviderInput): Promise<ProviderRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const parsed = providerSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("utility_providers")
    .insert({
      organization_id: parsed.organization_id,
      compound_id: parsed.compound_id ?? null,
      provider_name: parsed.provider_name,
      provider_type: parsed.provider_type,
      provider_code: parsed.provider_code ?? null,
      billing_method: parsed.billing_method,
      tariff_type: parsed.tariff_type,
      provider_status: parsed.provider_status,
      contact_name: parsed.contact_name ?? null,
      contact_email: parsed.contact_email ?? null,
      contact_phone: parsed.contact_phone ?? null,
      adapter_kind: parsed.adapter_kind ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/providers");
  return data as unknown as ProviderRow;
}

// ─── Internet Packages ────────────────────────────────────────────────────

export interface InternetPackageRow {
  id: string;
  organization_id: string;
  provider_id: string;
  package_name: string;
  package_tier: string;
  speed_mbps_down: number;
  speed_mbps_up: number | null;
  data_cap_gb: number | null;
  monthly_price: number;
  currency: string;
  suspension_policy: string;
  is_active: boolean;
  description: string | null;
}

export async function listInternetPackages(): Promise<InternetPackageRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("internet_packages").select("*").order("monthly_price");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as InternetPackageRow[];
}

export async function createInternetPackage(input: InternetPackageInput): Promise<InternetPackageRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const parsed = internetPackageSchema.parse(input);
  const supabase = await createClient();
  const { data: p } = await supabase.from("utility_providers").select("organization_id").eq("id", parsed.provider_id).single();
  if (!p) throw new Error("Provider not found");
  const { data, error } = await supabase
    .from("internet_packages")
    .insert({
      organization_id: (p as { organization_id: string }).organization_id,
      provider_id: parsed.provider_id,
      package_name: parsed.package_name,
      package_tier: parsed.package_tier,
      speed_mbps_down: parsed.speed_mbps_down,
      speed_mbps_up: parsed.speed_mbps_up ?? null,
      data_cap_gb: parsed.data_cap_gb ?? null,
      monthly_price: parsed.monthly_price,
      currency: parsed.currency,
      suspension_policy: parsed.suspension_policy,
      is_active: parsed.is_active,
      description: parsed.description ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/internet-packages");
  return data as unknown as InternetPackageRow;
}

// ─── Subscriptions ────────────────────────────────────────────────────────

export interface SubscriptionRow {
  id: string;
  organization_id: string;
  compound_id: string;
  unit_id: string;
  resident_id: string | null;
  provider_id: string;
  subscription_type: string;
  billing_cycle: string;
  monthly_fee: number;
  currency: string;
  internet_package_id: string | null;
  start_date: string;
  end_date: string | null;
  next_billing_date: string | null;
  last_billed_at: string | null;
  status: string;
  auto_suspend: boolean;
  notes: string | null;
  created_at: string;
}

interface SubListOpts {
  status?: string;
  utilityType?: string;
  page?: number;
  pageSize?: number;
}

export interface EnrichedSubscriptionRow extends SubscriptionRow {
  unit_number: string | null;
  building_name: string | null;
  provider_name: string | null;
  resident_full_name: string | null;
}

export async function listSubscriptions(opts: SubListOpts = {}): Promise<{ data: EnrichedSubscriptionRow[]; total: number }> {
  await requireUser();
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 25);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let q = supabase.from("utility_subscriptions")
    .select(
      "*, unit:units(unit_number, building:buildings(name)), provider:utility_providers(provider_name), resident:residents(first_name, last_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (opts.utilityType && opts.utilityType !== "all") q = q.eq("subscription_type", opts.utilityType as any);
  const { data, count, error } = await q;
  if (error) throw new Error(error.message);

  type RawRow = SubscriptionRow & {
    unit: { unit_number: string | null; building: { name: string | null } | null } | null;
    provider: { provider_name: string | null } | null;
    resident: { first_name: string | null; last_name: string | null } | null;
  };

  const rows = ((data ?? []) as unknown as RawRow[]).map((r) => ({
    ...r,
    unit_number:        r.unit?.unit_number ?? null,
    building_name:      r.unit?.building?.name ?? null,
    provider_name:      r.provider?.provider_name ?? null,
    resident_full_name: r.resident
      ? [r.resident.first_name, r.resident.last_name].filter(Boolean).join(" ") || null
      : null,
  }));

  return { data: rows, total: count ?? 0 };
}

export async function createSubscription(input: SubscriptionInput): Promise<SubscriptionRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const parsed = subscriptionSchema.parse(input);
  const supabase = await createClient();
  const { data: unit } = await supabase.from("units").select("organization_id, compound_id").eq("id", parsed.unit_id).single();
  if (!unit) throw new Error("Unit not found");
  const u = unit as { organization_id: string; compound_id: string };

  const { data, error } = await supabase
    .from("utility_subscriptions")
    .insert({
      organization_id: u.organization_id,
      compound_id: u.compound_id,
      unit_id: parsed.unit_id,
      resident_id: parsed.resident_id ?? null,
      provider_id: parsed.provider_id,
      subscription_type: parsed.subscription_type,
      billing_cycle: parsed.billing_cycle,
      monthly_fee: parsed.monthly_fee,
      currency: parsed.currency,
      internet_package_id: parsed.internet_package_id ?? null,
      start_date: parsed.start_date,
      end_date: parsed.end_date ?? null,
      next_billing_date: parsed.start_date,
      auto_suspend: parsed.auto_suspend,
      notes: parsed.notes ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/subscriptions");
  return data as unknown as SubscriptionRow;
}

export async function suspendSubscription(id: string, reason: string, notes?: string): Promise<void> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("suspend_subscription", {
    p_subscription_id: id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- enum narrowing
    p_reason: reason as any,
    p_notes: notes ?? undefined,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/subscriptions");
}

export async function releaseSubscription(id: string): Promise<void> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("release_suspension", { p_subscription_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/subscriptions");
}

// ─── Meters ────────────────────────────────────────────────────────────────

export interface MeterRow {
  id: string;
  organization_id: string;
  compound_id: string;
  unit_id: string | null;
  meter_number: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  installed_at: string | null;
  current_reading: number;
  unit_of_measure: string;
  status: string;
  smart_enabled: boolean;
  adapter_kind: string | null;
  notes: string | null;
}

export async function listMeters(): Promise<MeterRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("electricity_meters").select("*").order("meter_number");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MeterRow[];
}

export async function getMeter(id: string): Promise<MeterRow | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("electricity_meters").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as MeterRow) ?? null;
}

export async function createMeter(input: MeterInput): Promise<MeterRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager", "maintenance_staff"]);
  const parsed = meterSchema.parse(input);
  const supabase = await createClient();
  const { data: c } = await supabase.from("compounds").select("organization_id").eq("id", parsed.compound_id).single();
  if (!c) throw new Error("Compound not found");
  const { data, error } = await supabase
    .from("electricity_meters")
    .insert({
      organization_id: (c as { organization_id: string }).organization_id,
      compound_id: parsed.compound_id,
      unit_id: parsed.unit_id ?? null,
      meter_number: parsed.meter_number,
      brand: parsed.brand ?? null,
      model: parsed.model ?? null,
      serial_number: parsed.serial_number ?? null,
      installed_at: parsed.installed_at ?? null,
      current_reading: parsed.current_reading,
      unit_of_measure: parsed.unit_of_measure,
      smart_enabled: parsed.smart_enabled,
      notes: parsed.notes ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/meters");
  return data as unknown as MeterRow;
}

// ─── Readings ──────────────────────────────────────────────────────────────

export interface ReadingRow {
  id: string;
  meter_id: string;
  reading_date: string;
  reading_value: number;
  previous_reading: number;
  consumption: number;
  source: string;
  is_validated: boolean;
  notes: string | null;
  created_at: string;
}

export async function listReadings(meterId: string): Promise<ReadingRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meter_readings").select("*").eq("meter_id", meterId)
    .order("reading_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ReadingRow[];
}

export async function recordReading(input: ReadingInput): Promise<ReadingRow> {
  const user = await requireUser();
  const parsed = readingSchema.parse(input);
  const supabase = await createClient();

  const { data: meter } = await supabase
    .from("electricity_meters").select("organization_id, current_reading").eq("id", parsed.meter_id).single();
  if (!meter) throw new Error("Meter not found");
  const m = meter as { organization_id: string; current_reading: number };

  if (parsed.reading_value < m.current_reading) {
    throw new Error(`New reading (${parsed.reading_value}) is lower than current (${m.current_reading}). Refusing to record.`);
  }

  const { data, error } = await supabase
    .from("meter_readings")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- meter_readings types out-of-sync with schema
    .insert({
      organization_id: m.organization_id,
      meter_id: parsed.meter_id,
      reading_date: parsed.reading_date,
      reading_value: parsed.reading_value,
      previous_reading: m.current_reading,
      source: parsed.source,
      notes: parsed.notes ?? null,
      created_by: user.id,
    } as any)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/meters/${parsed.meter_id}`);
  return data as unknown as ReadingRow;
}

export async function generateElectricityBillFromReading(readingId: string): Promise<string> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_electricity_bill_for_reading", { p_reading_id: readingId });
  if (error) throw new Error(error.message);
  revalidatePath("/utility-bills");
  return String(data);
}

// ─── Tariffs ───────────────────────────────────────────────────────────────

export async function createTariff(input: TariffInput): Promise<void> {
  const user = await requireRole(["super_admin", "developer_admin", "finance_officer", "compound_manager"]);
  const parsed = tariffSchema.parse(input);
  const supabase = await createClient();
  const { data: p } = await supabase.from("utility_providers").select("organization_id").eq("id", parsed.provider_id).single();
  if (!p) throw new Error("Provider not found");
  const { error } = await supabase.from("electricity_tariffs").insert({
    organization_id: (p as { organization_id: string }).organization_id,
    provider_id: parsed.provider_id,
    tariff_name: parsed.tariff_name,
    rate_per_unit: parsed.rate_per_unit,
    service_fee: parsed.service_fee,
    currency: parsed.currency,
    effective_from: parsed.effective_from,
    effective_to: parsed.effective_to ?? null,
    created_by: user.id,
    updated_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/providers");
}

// ─── Utility Bills ─────────────────────────────────────────────────────────

export interface UtilityBillRow {
  id: string;
  organization_id: string;
  compound_id: string;
  unit_id: string | null;
  resident_id: string | null;
  subscription_id: string | null;
  bill_number: string;
  utility_type: string;
  billing_period_start: string;
  billing_period_end: string;
  due_date: string;
  consumption: number | null;
  subtotal: number;
  tax_amount: number;
  penalty_amount: number;
  paid_amount: number;
  total_amount: number;
  currency: string;
  status: string;
  created_at: string;
}

interface BillListOpts {
  status?: string;
  utilityType?: string;
  page?: number;
  pageSize?: number;
}

export async function listUtilityBills(opts: BillListOpts = {}): Promise<{ data: UtilityBillRow[]; total: number }> {
  await requireUser();
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 25);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let q = supabase.from("utility_bills").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (opts.utilityType && opts.utilityType !== "all") q = q.eq("utility_type", opts.utilityType as any);
  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return { data: (data ?? []) as unknown as UtilityBillRow[], total: count ?? 0 };
}

export async function generateRecurringBills(): Promise<number> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.rpc("generate_recurring_utility_bills", { p_billing_date: today });
  if (error) throw new Error(error.message);
  revalidatePath("/utility-bills");
  return Number(data) || 0;
}

// ─── Gas orders ────────────────────────────────────────────────────────────

export interface GasOrderRow {
  id: string;
  order_number: string;
  cylinder_count: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  delivery_address: string | null;
  scheduled_for: string | null;
  delivered_at: string | null;
  status: string;
  created_at: string;
}

export async function listGasOrders(): Promise<GasOrderRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("gas_orders").select("*").order("requested_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as GasOrderRow[];
}

export async function createGasOrder(input: GasOrderInput): Promise<GasOrderRow> {
  const user = await requireUser();
  const parsed = gasOrderSchema.parse(input);
  const supabase = await createClient();
  const { data: c } = await supabase.from("compounds").select("organization_id").eq("id", parsed.compound_id).single();
  if (!c) throw new Error("Compound not found");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- gas_orders requires order_number (set by trigger); insert payload casts to any so TS doesn't reject.
  const { data, error } = await (supabase.from("gas_orders") as any)
    .insert({
      organization_id: (c as { organization_id: string }).organization_id,
      compound_id: parsed.compound_id,
      unit_id: parsed.unit_id ?? null,
      resident_id: parsed.resident_id ?? null,
      provider_id: parsed.provider_id,
      cylinder_count: parsed.cylinder_count,
      unit_price: parsed.unit_price,
      currency: parsed.currency,
      delivery_address: parsed.delivery_address ?? null,
      scheduled_for: parsed.scheduled_for ? new Date(parsed.scheduled_for).toISOString() : null,
      notes: parsed.notes ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/gas-orders");
  return data as unknown as GasOrderRow;
}
