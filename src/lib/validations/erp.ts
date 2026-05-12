import { z } from "zod";

const optionalString = z
  .string().trim().max(2000)
  .optional().or(z.literal("").transform(() => undefined));

const optionalUuid = z.string().uuid().optional().or(z.literal("").transform(() => undefined));

export const ERP_KINDS = [
  "odoo","sap","csv","custom","sage","quickbooks","xero","generic",
] as const;

export const MAPPING_KINDS = [
  "installment_revenue","utility_revenue","marketplace_revenue","commission_income",
  "cash_account","bank_account","penalty_income","refund_expense",
  "tax_payable","customer_receivable","provider_payable","other",
] as const;

export const erpIntegrationSchema = z.object({
  organization_id: z.string().uuid(),
  kind: z.enum(ERP_KINDS),
  name: z.string().trim().min(2).max(120),
  base_url: optionalString,
  database_name: optionalString,
  username: optionalString,
  credentials_ref: optionalString,
  company_external_id: optionalString,
  default_currency: z.string().default("USD"),
  config: z.record(z.string(), z.unknown()).default({}),
  is_active: z.boolean().default(true),
  auto_push: z.boolean().default(true),
  csv_export_path: optionalString,
});
export type ErpIntegrationInput = z.infer<typeof erpIntegrationSchema>;

export const accountMappingSchema = z.object({
  organization_id: z.string().uuid(),
  integration_id: z.string().uuid(),
  mapping_kind: z.enum(MAPPING_KINDS),
  compound_id: optionalUuid,
  currency: optionalString,
  payment_method: optionalString,
  gl_account_external_id: z.string().trim().min(1).max(64),
  notes: optionalString,
});
export type AccountMappingInput = z.infer<typeof accountMappingSchema>;

export const glAccountSchema = z.object({
  organization_id: z.string().uuid(),
  integration_id: optionalUuid,
  external_id: z.string().trim().min(1).max(64),
  account_code: z.string().trim().min(1).max(32),
  account_name: z.string().trim().min(2).max(160),
  account_type: optionalString,
  currency: z.string().default("USD"),
  is_active: z.boolean().default(true),
});
export type GlAccountInput = z.infer<typeof glAccountSchema>;
