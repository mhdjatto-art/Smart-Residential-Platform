"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, requireUser } from "@/lib/auth/guards";
import {
  erpIntegrationSchema, accountMappingSchema, glAccountSchema,
  type ErpIntegrationInput, type AccountMappingInput, type GlAccountInput,
} from "@/lib/validations/erp";

// ─── ERP Integrations ─────────────────────────────────────────────────────

export interface ErpIntegrationRow {
  id: string;
  organization_id: string;
  kind: string;
  name: string;
  base_url: string | null;
  database_name: string | null;
  username: string | null;
  company_external_id: string | null;
  default_currency: string;
  status: string;
  last_synced_at: string | null;
  last_error: string | null;
  is_active: boolean;
  auto_push: boolean;
  csv_export_path: string | null;
}

export async function listErpIntegrations(): Promise<ErpIntegrationRow[]> {
  await requireRole(["super_admin","developer_admin","finance_officer"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("erp_integrations").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ErpIntegrationRow[];
}

export async function createErpIntegration(input: ErpIntegrationInput): Promise<ErpIntegrationRow> {
  const user = await requireRole(["super_admin","developer_admin"]);
  const parsed = erpIntegrationSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("erp_integrations")
    .insert({
      organization_id: parsed.organization_id,
      kind: parsed.kind,
      name: parsed.name,
      base_url: parsed.base_url ?? null,
      database_name: parsed.database_name ?? null,
      username: parsed.username ?? null,
      credentials_ref: parsed.credentials_ref ?? null,
      company_external_id: parsed.company_external_id ?? null,
      default_currency: parsed.default_currency,
      config: parsed.config,
      is_active: parsed.is_active,
      auto_push: parsed.auto_push,
      csv_export_path: parsed.csv_export_path ?? null,
      created_by: user.id,
    })
    .select("*").single();
  if (error) throw new Error(error.message);
  revalidatePath("/erp");
  return data as unknown as ErpIntegrationRow;
}

// ─── Account mappings ─────────────────────────────────────────────────────

export interface AccountMappingRow {
  id: string;
  integration_id: string;
  mapping_kind: string;
  compound_id: string | null;
  currency: string | null;
  payment_method: string | null;
  gl_account_external_id: string;
  notes: string | null;
}

export async function listAccountMappings(integrationId?: string): Promise<AccountMappingRow[]> {
  await requireRole(["super_admin","developer_admin","finance_officer"]);
  const supabase = await createClient();
  let q = supabase.from("account_mappings").select("*").order("mapping_kind");
  if (integrationId) q = q.eq("integration_id", integrationId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AccountMappingRow[];
}

export async function upsertAccountMapping(input: AccountMappingInput): Promise<void> {
  await requireRole(["super_admin","developer_admin","finance_officer"]);
  const parsed = accountMappingSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("account_mappings").upsert({
    organization_id: parsed.organization_id,
    integration_id: parsed.integration_id,
    mapping_kind: parsed.mapping_kind,
    compound_id: parsed.compound_id ?? null,
    currency: parsed.currency ?? null,
    payment_method: parsed.payment_method ?? null,
    gl_account_external_id: parsed.gl_account_external_id,
    notes: parsed.notes ?? null,
  }, { onConflict: "integration_id,mapping_kind,compound_id,currency,payment_method" });
  if (error) throw new Error(error.message);
  revalidatePath("/erp");
}

// ─── GL accounts (cached chart of accounts) ──────────────────────────────

export interface GlAccountRow {
  id: string;
  integration_id: string | null;
  external_id: string;
  account_code: string;
  account_name: string;
  account_type: string | null;
  currency: string;
  is_active: boolean;
}

export async function listGlAccounts(integrationId?: string): Promise<GlAccountRow[]> {
  await requireUser();
  const supabase = await createClient();
  let q = supabase.from("gl_accounts").select("*").order("account_code");
  if (integrationId) q = q.eq("integration_id", integrationId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as GlAccountRow[];
}

export async function createGlAccount(input: GlAccountInput): Promise<void> {
  await requireRole(["super_admin","developer_admin","finance_officer"]);
  const parsed = glAccountSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("gl_accounts").insert({
    organization_id: parsed.organization_id,
    integration_id: parsed.integration_id ?? null,
    external_id: parsed.external_id,
    account_code: parsed.account_code,
    account_name: parsed.account_name,
    account_type: parsed.account_type ?? null,
    currency: parsed.currency,
    is_active: parsed.is_active,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/erp");
}

// ─── Journal entries ──────────────────────────────────────────────────────

export interface JournalEntryRow {
  id: string;
  entry_number: string;
  entry_date: string;
  reference: string | null;
  description: string | null;
  source_table: string | null;
  currency: string;
  total_amount: number;
  status: string;
  external_journal_id: string | null;
  posted_at: string | null;
  retry_count: number;
  created_at: string;
}

export async function listJournalEntries(filter?: { status?: string }): Promise<JournalEntryRow[]> {
  await requireRole(["super_admin","developer_admin","finance_officer","compound_manager"]);
  const supabase = await createClient();
  let q = supabase.from("journal_entries").select("*").order("entry_date", { ascending: false }).limit(200);
  if (filter?.status) q = q.eq("status", filter.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as JournalEntryRow[];
}

export interface ErpSyncLogRow {
  id: number;
  integration_id: string | null;
  entry_id: string | null;
  action: string;
  outcome: string;
  http_status: number | null;
  duration_ms: number | null;
  error_message: string | null;
  external_id_returned: string | null;
  occurred_at: string;
}

export async function listErpSyncLogs(integrationId?: string): Promise<ErpSyncLogRow[]> {
  await requireRole(["super_admin","developer_admin","finance_officer"]);
  const supabase = await createClient();
  let q = supabase.from("erp_sync_log").select("*").order("occurred_at", { ascending: false }).limit(200);
  if (integrationId) q = q.eq("integration_id", integrationId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ErpSyncLogRow[];
}

// ─── Manual JE generation (for testing) ──────────────────────────────────

export async function generateJournalForPayment(paymentId: string): Promise<string> {
  await requireRole(["super_admin","developer_admin","finance_officer"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_journal_entry_for_payment", { p_payment_id: paymentId });
  if (error) throw new Error(error.message);
  revalidatePath("/erp/entries");
  return data as unknown as string;
}
