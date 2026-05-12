import { z } from "zod";

const optionalString = z
  .string().trim().max(2000)
  .optional().or(z.literal("").transform(() => undefined));

export const UTILITY_TYPES = ["electricity","internet","gas","water","maintenance","generator","other"] as const;

export const providerSchema = z.object({
  organization_id: z.string().uuid(),
  compound_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  provider_name: z.string().trim().min(2).max(120),
  provider_type: z.enum(UTILITY_TYPES),
  provider_code: optionalString,
  billing_method: z.enum(["flat","metered","tiered","time_of_use","package","pay_per_use"]).default("flat"),
  tariff_type: z.enum(["fixed","tiered","time_of_use","seasonal"]).default("fixed"),
  provider_status: z.enum(["active","inactive","suspended"]).default("active"),
  contact_name: optionalString,
  contact_email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  contact_phone: optionalString,
  adapter_kind: optionalString,
});
export type ProviderInput = z.infer<typeof providerSchema>;

export const internetPackageSchema = z.object({
  provider_id: z.string().uuid(),
  package_name: z.string().trim().min(2).max(120),
  package_tier: z.enum(["basic","standard","premium","enterprise","custom"]).default("standard"),
  speed_mbps_down: z.coerce.number().int().min(1).max(100000),
  speed_mbps_up: z.coerce.number().int().min(1).max(100000).optional(),
  data_cap_gb: z.coerce.number().int().min(0).max(1_000_000).optional(),
  monthly_price: z.coerce.number().min(0).max(1_000_000),
  currency: z.string().default("USD"),
  suspension_policy: z.enum(["immediate","after_grace","manual","never"]).default("after_grace"),
  is_active: z.boolean().default(true),
  description: optionalString,
});
export type InternetPackageInput = z.infer<typeof internetPackageSchema>;

export const subscriptionSchema = z.object({
  unit_id: z.string().uuid(),
  resident_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  provider_id: z.string().uuid(),
  subscription_type: z.enum(UTILITY_TYPES),
  billing_cycle: z.enum(["monthly","quarterly","biannual","annual","one_time"]).default("monthly"),
  monthly_fee: z.coerce.number().min(0).max(1_000_000).default(0),
  currency: z.string().default("USD"),
  internet_package_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
  auto_suspend: z.boolean().default(true),
  notes: optionalString,
});
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

export const meterSchema = z.object({
  compound_id: z.string().uuid(),
  unit_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  meter_number: z.string().trim().min(1).max(64),
  brand: optionalString,
  model: optionalString,
  serial_number: optionalString,
  installed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
  current_reading: z.coerce.number().min(0).default(0),
  unit_of_measure: z.string().default("kWh"),
  smart_enabled: z.boolean().default(false),
  notes: optionalString,
});
export type MeterInput = z.infer<typeof meterSchema>;

export const readingSchema = z.object({
  meter_id: z.string().uuid(),
  reading_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reading_value: z.coerce.number().min(0),
  source: z.enum(["manual","photo","smart_meter","imported"]).default("manual"),
  notes: optionalString,
});
export type ReadingInput = z.infer<typeof readingSchema>;

export const tariffSchema = z.object({
  provider_id: z.string().uuid(),
  tariff_name: z.string().trim().min(2).max(120),
  rate_per_unit: z.coerce.number().min(0),
  service_fee: z.coerce.number().min(0).default(0),
  currency: z.string().default("USD"),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
});
export type TariffInput = z.infer<typeof tariffSchema>;

export const gasOrderSchema = z.object({
  compound_id: z.string().uuid(),
  unit_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  resident_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  provider_id: z.string().uuid(),
  cylinder_count: z.coerce.number().int().min(1).max(50).default(1),
  unit_price: z.coerce.number().min(0),
  currency: z.string().default("USD"),
  delivery_address: optionalString,
  scheduled_for: z.string().optional().or(z.literal("").transform(() => undefined)),
  notes: optionalString,
});
export type GasOrderInput = z.infer<typeof gasOrderSchema>;
