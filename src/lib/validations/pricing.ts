import { z } from "zod";

const optionalString = z
  .string().trim().max(2000)
  .optional().or(z.literal("").transform(() => undefined));

const optionalUuid = z.string().uuid().optional().or(z.literal("").transform(() => undefined));

export const PRICING_METHODS = [
  "flat","per_sqm","per_resident","tiered","formula","time_of_use","seasonal",
] as const;

export const SERVICE_KINDS = [
  "electricity","internet","gas","water","generator","maintenance","cleaning",
  "security","trash","parking","other",
] as const;

export const ADAPTER_KINDS = [
  "mikrotik","unifi","modbus","radius","mqtt","rest","webhook","generic",
] as const;

export const tierSchema = z.object({
  from: z.coerce.number().min(0),
  to:   z.coerce.number().min(0).optional().nullable(),
  price: z.coerce.number().min(0),
});

export const pricingRuleSchema = z.object({
  organization_id: z.string().uuid(),
  compound_id: optionalUuid,
  name: z.string().trim().min(2).max(120),
  service_kind: z.string().min(2).max(40),
  method: z.enum(PRICING_METHODS),
  base_amount: z.coerce.number().min(0).max(10_000_000).default(0),
  unit_amount: z.coerce.number().min(0).max(1_000_000).default(0),
  min_amount: z.coerce.number().min(0).max(10_000_000).optional().or(z.literal("").transform(() => undefined)),
  max_amount: z.coerce.number().min(0).max(10_000_000).optional().or(z.literal("").transform(() => undefined)),
  currency: z.string().default("USD"),
  tiers: z.array(tierSchema).default([]),
  formula: optionalString,
  schedule: z.record(z.string(), z.unknown()).default({}),
  is_active: z.boolean().default(true),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  effective_to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
  priority: z.coerce.number().int().min(0).max(10_000).default(100),
  notes: optionalString,
});
export type PricingRuleInput = z.infer<typeof pricingRuleSchema>;

export const integrationSchema = z.object({
  organization_id: z.string().uuid(),
  provider_id: optionalUuid,
  adapter_kind: z.enum(ADAPTER_KINDS),
  name: z.string().trim().min(2).max(120),
  endpoint_url: optionalString,
  config: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(["disconnected","configured","connected","degraded","error"]).default("configured"),
  is_active: z.boolean().default(true),
  health_check_url: optionalString,
});
export type IntegrationInput = z.infer<typeof integrationSchema>;
