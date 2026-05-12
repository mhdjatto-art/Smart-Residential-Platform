"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { automationRuleSchema, type AutomationRuleInput } from "@/lib/validations/automation";

export interface AutomationRuleRow {
  id: string;
  organization_id: string;
  compound_id: string | null;
  name: string;
  description: string | null;
  trigger_kind: string;
  trigger_config: Record<string, unknown>;
  action: string;
  action_config: Record<string, unknown>;
  status: string;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
  failure_count: number;
  created_at: string;
}

export interface AutomationRunRow {
  id: string;
  rule_id: string;
  triggered_at: string;
  outcome: string;
  rows_affected: number;
  error_message: string | null;
  duration_ms: number | null;
}

export async function listAutomationRules(): Promise<AutomationRuleRow[]> {
  await requireRole(["super_admin","developer_admin","compound_manager","finance_officer"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("automation_rules").select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AutomationRuleRow[];
}

export async function createAutomationRule(input: AutomationRuleInput): Promise<AutomationRuleRow> {
  const user = await requireRole(["super_admin","developer_admin","compound_manager"]);
  const parsed = automationRuleSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("automation_rules")
    .insert({
      organization_id: parsed.organization_id,
      compound_id: parsed.compound_id ?? null,
      name: parsed.name,
      description: parsed.description ?? null,
      trigger_kind: parsed.trigger_kind,
      trigger_config: parsed.trigger_config,
      action: parsed.action,
      action_config: parsed.action_config,
      status: parsed.status,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*").single();
  if (error) throw new Error(error.message);
  revalidatePath("/automation");
  return data as unknown as AutomationRuleRow;
}

export async function setAutomationStatus(id: string, status: "active"|"paused"|"disabled"): Promise<void> {
  const user = await requireRole(["super_admin","developer_admin","compound_manager"]);
  const supabase = await createClient();
  const { error } = await supabase.from("automation_rules").update({ status, updated_by: user.id }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/automation");
}

export async function listAutomationRuns(ruleId?: string): Promise<AutomationRunRow[]> {
  await requireRole(["super_admin","developer_admin","compound_manager","finance_officer"]);
  const supabase = await createClient();
  let q = supabase.from("automation_runs").select("*").order("triggered_at", { ascending: false }).limit(100);
  if (ruleId) q = q.eq("rule_id", ruleId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AutomationRunRow[];
}

export async function executeDueRulesNow(): Promise<number> {
  await requireRole(["super_admin","developer_admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("execute_due_automation_rules");
  if (error) throw new Error(error.message);
  revalidatePath("/automation");
  return Number(data ?? 0);
}
