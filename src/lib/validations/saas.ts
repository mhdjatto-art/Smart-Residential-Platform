import { z } from "zod";

const optionalString = z
  .string().trim().max(2000)
  .optional().or(z.literal("").transform(() => undefined));

const colorHex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use #RRGGBB").default("#0B1F3A");

export const PLAN_TIERS = ["starter","professional","enterprise","custom"] as const;
export const SUBSCRIPTION_STATUSES = ["trialing","active","past_due","suspended","cancelled"] as const;
export const BILLING_CYCLES = ["monthly","quarterly","annual","custom"] as const;
export const SUPPORTED_LOCALES = ["en","ar","ku"] as const;

export const provisionOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,64}$/, "Lowercase letters, digits, hyphens"),
  plan_code: z.string().trim().min(1).default("starter"),
  contact_email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  country_code: optionalString,
  default_locale: z.enum(SUPPORTED_LOCALES).default("en"),
  timezone: z.string().default("UTC"),
});
export type ProvisionOrganizationInput = z.infer<typeof provisionOrganizationSchema>;

/**
 * Multi-language text. Keys are locale codes (en, ar, ku); values are the
 * translation. Empty object means "use the default in the i18n bundle".
 */
const multiLangText = z.record(z.string(), z.string().max(500)).optional();

export const brandingSchema = z.object({
  organization_id: z.string().uuid(),
  logo_path: optionalString,
  logo_dark_path: optionalString,
  favicon_path: optionalString,
  primary_color: colorHex,
  accent_color:  colorHex,
  background_color: optionalString,
  font_family: z.string().default("Inter"),
  custom_css: optionalString,
  email_from_name: optionalString,
  email_footer: optionalString,
  // Phase 25 — login page customisation
  login_hero_path:         optionalString,
  login_welcome_title:     multiLangText,
  login_welcome_subtitle:  multiLangText,
});
export type BrandingInput = z.infer<typeof brandingSchema>;

export const domainSchema = z.object({
  organization_id: z.string().uuid(),
  host: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]{3,253}$/, "Invalid hostname"),
  is_primary: z.boolean().default(false),
});
export type DomainInput = z.infer<typeof domainSchema>;

export const orgSettingsSchema = z.object({
  organization_id: z.string().uuid(),
  default_locale: z.enum(SUPPORTED_LOCALES).default("en"),
  supported_locales: z.array(z.enum(SUPPORTED_LOCALES)).min(1).default(["en"]),
  timezone: z.string().default("UTC"),
  date_format: z.string().default("YYYY-MM-DD"),
  rtl_enabled: z.boolean().default(false),
});
export type OrgSettingsInput = z.infer<typeof orgSettingsSchema>;

export const planFeatureToggleSchema = z.object({
  organization_id: z.string().uuid(),
  feature: z.string().trim().min(2),
  is_enabled: z.boolean(),
  reason: optionalString,
  expires_at: optionalString,
});
export type PlanFeatureToggleInput = z.infer<typeof planFeatureToggleSchema>;
