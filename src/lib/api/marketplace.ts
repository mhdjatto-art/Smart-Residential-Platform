"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";
import {
  serviceProviderSchema, serviceCategorySchema, serviceItemSchema,
  placeOrderSchema, reviewSchema, orderStatusUpdateSchema,
  type ServiceProviderInput, type ServiceCategoryInput, type ServiceItemInput,
  type PlaceOrderInput, type ReviewInput, type OrderStatusUpdateInput,
} from "@/lib/validations/marketplace";

// ─── service_providers ─────────────────────────────────────────────────────

export interface ServiceProviderRow {
  id: string;
  organization_id: string;
  compound_id: string | null;
  provider_name: string;
  provider_kind: string;
  slug: string;
  description: string | null;
  logo_path: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  rating_avg: number;
  rating_count: number;
  verification_status: string;
  availability_status: string;
  is_active: boolean;
  default_commission_kind: string;
  default_commission_value: number;
  created_at: string;
}

export async function listServiceProviders(): Promise<ServiceProviderRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_providers").select("*")
    .order("rating_avg", { ascending: false })
    .order("provider_name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ServiceProviderRow[];
}

export async function getServiceProvider(id: string): Promise<ServiceProviderRow | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_providers").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as ServiceProviderRow) ?? null;
}

export async function createServiceProvider(input: ServiceProviderInput): Promise<ServiceProviderRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const parsed = serviceProviderSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_providers")
    .insert({
      organization_id: parsed.organization_id,
      compound_id: parsed.compound_id ?? null,
      provider_name: parsed.provider_name,
      provider_kind: parsed.provider_kind,
      slug: parsed.slug,
      description: parsed.description ?? null,
      mobile: parsed.mobile ?? null,
      email: parsed.email ?? null,
      website: parsed.website ?? null,
      address: parsed.address ?? null,
      verification_status: parsed.verification_status,
      availability_status: parsed.availability_status,
      is_active: parsed.is_active,
      default_commission_kind: parsed.default_commission_kind,
      default_commission_value: parsed.default_commission_value,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*").single();
  if (error) throw new Error(error.message);
  revalidatePath("/service-providers");
  revalidatePath("/marketplace");
  return data as unknown as ServiceProviderRow;
}

export async function updateServiceProvider(id: string, input: Partial<ServiceProviderInput>): Promise<void> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_providers")
    .update({
      provider_name: input.provider_name,
      provider_kind: input.provider_kind,
      description: input.description ?? null,
      mobile: input.mobile ?? null,
      email: input.email ?? null,
      website: input.website ?? null,
      address: input.address ?? null,
      verification_status: input.verification_status,
      availability_status: input.availability_status,
      is_active: input.is_active,
      default_commission_kind: input.default_commission_kind,
      default_commission_value: input.default_commission_value,
      compound_id: input.compound_id ?? null,
      updated_by: user.id,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/service-providers");
  revalidatePath(`/service-providers/${id}`);
}

export async function deleteServiceProvider(id: string): Promise<void> {
  await requireRole(["super_admin", "developer_admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("service_providers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/service-providers");
}

// ─── service_categories ────────────────────────────────────────────────────

export interface ServiceCategoryRow {
  id: string;
  organization_id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  icon: string | null;
  display_order: number;
  is_active: boolean;
}

export async function listServiceCategories(): Promise<ServiceCategoryRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_categories").select("*").order("display_order").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ServiceCategoryRow[];
}

export async function createServiceCategory(input: ServiceCategoryInput): Promise<void> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const parsed = serviceCategorySchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("service_categories").insert({
    organization_id: parsed.organization_id,
    parent_id: parsed.parent_id ?? null,
    name: parsed.name,
    slug: parsed.slug,
    icon: parsed.icon ?? null,
    display_order: parsed.display_order,
    is_active: parsed.is_active,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/marketplace");
}

// ─── service_items ─────────────────────────────────────────────────────────

export interface ServiceItemRow {
  id: string;
  organization_id: string;
  provider_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  service_kind: string;
  price: number;
  currency: string;
  duration_minutes: number | null;
  unit: string | null;
  is_active: boolean;
}

export async function listServiceItems(filters?: { provider_id?: string }): Promise<ServiceItemRow[]> {
  await requireUser();
  const supabase = await createClient();
  let q = supabase.from("service_items").select("*").order("name");
  if (filters?.provider_id) q = q.eq("provider_id", filters.provider_id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ServiceItemRow[];
}

export async function createServiceItem(input: ServiceItemInput): Promise<ServiceItemRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const parsed = serviceItemSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_items")
    .insert({
      organization_id: parsed.organization_id,
      provider_id: parsed.provider_id,
      category_id: parsed.category_id ?? null,
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description ?? null,
      service_kind: parsed.service_kind,
      price: parsed.price,
      currency: parsed.currency,
      duration_minutes: parsed.duration_minutes ?? null,
      unit: parsed.unit ?? null,
      is_active: parsed.is_active,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*").single();
  if (error) throw new Error(error.message);
  revalidatePath("/marketplace");
  revalidatePath(`/service-providers/${parsed.provider_id}`);
  return data as unknown as ServiceItemRow;
}

export async function deleteServiceItem(id: string): Promise<void> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const { error } = await supabase.from("service_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/marketplace");
}

// ─── marketplace_orders ────────────────────────────────────────────────────

export interface MarketplaceOrderRow {
  id: string;
  organization_id: string;
  compound_id: string;
  resident_id: string;
  unit_id: string | null;
  provider_id: string;
  order_number: string;
  order_status: string;
  payment_status: string;
  scheduled_for: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  subtotal: number;
  service_fee: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  commission_amount: number;
  provider_net: number;
  currency: string;
  delivery_address: string | null;
  delivery_notes: string | null;
  payment_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface MarketplaceOrderItemRow {
  id: string;
  order_id: string;
  service_item_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  notes: string | null;
}

export async function listMarketplaceOrders(filters?: { status?: string }): Promise<MarketplaceOrderRow[]> {
  await requireUser();
  const supabase = await createClient();
  let q = supabase.from("marketplace_orders").select("*").order("created_at", { ascending: false }).limit(200);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (filters?.status) q = q.eq("order_status", filters.status as any);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MarketplaceOrderRow[];
}

export async function getMarketplaceOrder(id: string): Promise<MarketplaceOrderRow | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("marketplace_orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as MarketplaceOrderRow) ?? null;
}

export async function getMarketplaceOrderItems(orderId: string): Promise<MarketplaceOrderItemRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("marketplace_order_items").select("*").eq("order_id", orderId);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MarketplaceOrderItemRow[];
}

export async function placeOrder(input: PlaceOrderInput): Promise<string> {
  await requireUser();
  const parsed = placeOrderSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_provider_id: parsed.provider_id,
    p_resident_id: parsed.resident_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Record<string,unknown> not assignable to Json
    p_items: parsed.items as any,
    p_service_fee: parsed.service_fee,
    p_delivery_fee: parsed.delivery_fee,
    p_tax_amount: parsed.tax_amount,
    p_currency: parsed.currency,
    p_scheduled_for: parsed.scheduled_for ?? undefined,
    p_delivery_address: parsed.delivery_address ?? undefined,
    p_delivery_notes: parsed.delivery_notes ?? undefined,
    p_notes: parsed.notes ?? undefined,
    p_compound_id: parsed.compound_id ?? undefined,
    p_unit_id: parsed.unit_id ?? undefined,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/orders");
  revalidatePath("/marketplace");
  return data as unknown as string;
}

export async function updateOrderStatus(id: string, input: OrderStatusUpdateInput): Promise<void> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer", "maintenance_staff"]);
  const parsed = orderStatusUpdateSchema.parse(input);
  const supabase = await createClient();

  if (parsed.order_status === "cancelled") {
    const { error } = await supabase.rpc("cancel_marketplace_order", {
      p_order_id: id,
      p_reason: parsed.cancellation_reason ?? undefined,
    });
    if (error) throw new Error(error.message);
  } else if (parsed.order_status === "completed") {
    const { error } = await supabase.rpc("mark_order_completed", { p_order_id: id });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("marketplace_orders")
      .update({ order_status: parsed.order_status })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
}

// ─── reviews ───────────────────────────────────────────────────────────────

export interface ProviderReviewRow {
  id: string;
  organization_id: string;
  provider_id: string;
  order_id: string | null;
  resident_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  is_moderated: boolean;
  is_hidden: boolean;
  helpful_count: number;
  created_at: string;
}

export async function listReviews(filters?: { provider_id?: string }): Promise<ProviderReviewRow[]> {
  await requireUser();
  const supabase = await createClient();
  let q = supabase.from("provider_reviews").select("*").order("created_at", { ascending: false }).limit(200);
  if (filters?.provider_id) q = q.eq("provider_id", filters.provider_id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProviderReviewRow[];
}

export async function createReview(input: ReviewInput): Promise<void> {
  await requireUser();
  const parsed = reviewSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("provider_reviews").insert({
    organization_id: parsed.organization_id,
    provider_id: parsed.provider_id,
    resident_id: parsed.resident_id,
    order_id: parsed.order_id ?? null,
    rating: parsed.rating,
    title: parsed.title ?? null,
    body: parsed.body ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/marketplace");
  revalidatePath(`/service-providers/${parsed.provider_id}`);
}

// ─── stats ────────────────────────────────────────────────────────────────

export interface MarketplaceStats {
  active_providers: number;
  pending_orders: number;
  completed_orders_30d: number;
  revenue_30d: number;
  commission_30d: number;
  avg_rating: number;
}

export async function getMarketplaceStats(): Promise<MarketplaceStats> {
  await requireUser();
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [providers, pending, completed, ratings] = await Promise.all([
    supabase.from("service_providers").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("marketplace_orders").select("id", { count: "exact", head: true }).in("order_status", ["pending", "confirmed", "assigned", "in_progress"]),
    supabase.from("marketplace_orders").select("total_amount,commission_amount").eq("order_status", "completed").gte("completed_at", since),
    supabase.from("service_providers").select("rating_avg,rating_count").gt("rating_count", 0),
  ]);

  const completedRows = (completed.data ?? []) as Array<{ total_amount: number; commission_amount: number }>;
  const ratingRows = (ratings.data ?? []) as Array<{ rating_avg: number; rating_count: number }>;

  const revenue_30d = completedRows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const commission_30d = completedRows.reduce((s, r) => s + Number(r.commission_amount ?? 0), 0);

  const totalReviews = ratingRows.reduce((s, r) => s + (r.rating_count ?? 0), 0);
  const weightedSum  = ratingRows.reduce((s, r) => s + Number(r.rating_avg ?? 0) * (r.rating_count ?? 0), 0);
  const avg_rating = totalReviews > 0 ? Number((weightedSum / totalReviews).toFixed(2)) : 0;

  return {
    active_providers: providers.count ?? 0,
    pending_orders: pending.count ?? 0,
    completed_orders_30d: completedRows.length,
    revenue_30d,
    commission_30d,
    avg_rating,
  };
}
