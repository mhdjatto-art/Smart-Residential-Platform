import { z } from "zod";

const optionalString = z
  .string().trim().max(2000)
  .optional().or(z.literal("").transform(() => undefined));

const optionalUuid = z.string().uuid().optional().or(z.literal("").transform(() => undefined));

export const PROVIDER_KINDS = [
  "maintenance","cleaning","plumbing","electrician","ac_technician","grocery",
  "pharmacy","restaurant","laundry","moving","car_wash","delivery","security",
  "internet_services","other",
] as const;

export const SERVICE_KINDS = ["product","on_demand_service","subscription","package"] as const;
export const ORDER_STATUSES = ["pending","confirmed","assigned","in_progress","completed","cancelled","refunded"] as const;
export const ORDER_PAYMENT_STATUSES = ["unpaid","partial","paid","refunded"] as const;
export const COMMISSION_KINDS = ["percentage","fixed"] as const;
export const PROVIDER_VERIFICATION_STATUSES = ["unverified","pending","verified","rejected"] as const;
export const PROVIDER_AVAILABILITY_STATUSES = ["open","busy","closed"] as const;

const slugify = (s: string) =>
  s.toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const serviceProviderSchema = z.object({
  organization_id: z.string().uuid(),
  compound_id: optionalUuid,
  provider_name: z.string().trim().min(2).max(120),
  provider_kind: z.enum(PROVIDER_KINDS),
  slug: optionalString,
  description: optionalString,
  mobile: optionalString,
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  website: optionalString,
  address: optionalString,
  verification_status: z.enum(PROVIDER_VERIFICATION_STATUSES).default("unverified"),
  availability_status: z.enum(PROVIDER_AVAILABILITY_STATUSES).default("open"),
  is_active: z.boolean().default(true),
  default_commission_kind: z.enum(COMMISSION_KINDS).default("percentage"),
  default_commission_value: z.coerce.number().min(0).max(100_000).default(10),
}).transform((v) => ({
  ...v,
  slug: v.slug && v.slug.length ? slugify(v.slug) : slugify(v.provider_name),
}));
export type ServiceProviderInput = z.infer<typeof serviceProviderSchema>;

export const serviceCategorySchema = z.object({
  organization_id: z.string().uuid(),
  parent_id: optionalUuid,
  name: z.string().trim().min(2).max(120),
  slug: optionalString,
  icon: optionalString,
  display_order: z.coerce.number().int().min(0).max(10_000).default(0),
  is_active: z.boolean().default(true),
}).transform((v) => ({
  ...v,
  slug: v.slug && v.slug.length ? slugify(v.slug) : slugify(v.name),
}));
export type ServiceCategoryInput = z.infer<typeof serviceCategorySchema>;

export const serviceItemSchema = z.object({
  organization_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  category_id: optionalUuid,
  name: z.string().trim().min(2).max(160),
  slug: optionalString,
  description: optionalString,
  service_kind: z.enum(SERVICE_KINDS).default("on_demand_service"),
  price: z.coerce.number().min(0).max(10_000_000),
  currency: z.string().default("USD"),
  duration_minutes: z.coerce.number().int().min(0).max(100_000).optional(),
  unit: optionalString,
  is_active: z.boolean().default(true),
}).transform((v) => ({
  ...v,
  slug: v.slug && v.slug.length ? slugify(v.slug) : slugify(v.name),
}));
export type ServiceItemInput = z.infer<typeof serviceItemSchema>;

export const orderItemInputSchema = z.object({
  service_item_id: optionalUuid,
  item_name: z.string().trim().min(1).max(160),
  quantity: z.coerce.number().min(0.001).max(1_000_000).default(1),
  unit_price: z.coerce.number().min(0).max(10_000_000),
  notes: optionalString,
});
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

export const placeOrderSchema = z.object({
  provider_id: z.string().uuid(),
  resident_id: z.string().uuid(),
  items: z.array(orderItemInputSchema).min(1).max(50),
  service_fee: z.coerce.number().min(0).max(1_000_000).default(0),
  delivery_fee: z.coerce.number().min(0).max(1_000_000).default(0),
  tax_amount: z.coerce.number().min(0).max(1_000_000).default(0),
  currency: z.string().default("USD"),
  scheduled_for: optionalString,
  delivery_address: optionalString,
  delivery_notes: optionalString,
  notes: optionalString,
  compound_id: optionalUuid,
  unit_id: optionalUuid,
});
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export const reviewSchema = z.object({
  organization_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  resident_id: z.string().uuid(),
  order_id: optionalUuid,
  rating: z.coerce.number().int().min(1).max(5),
  title: optionalString,
  body: optionalString,
});
export type ReviewInput = z.infer<typeof reviewSchema>;

export const orderStatusUpdateSchema = z.object({
  order_status: z.enum(ORDER_STATUSES),
  cancellation_reason: optionalString,
});
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;
