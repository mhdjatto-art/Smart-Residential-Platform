"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";

/**
 * Matches the actual `audit_log` schema from migration 003:
 *   id bigserial
 *   actor_id uuid
 *   organization_id uuid
 *   compound_id uuid
 *   table_name text
 *   row_id uuid
 *   action 'insert' | 'update' | 'delete'  (lowercase)
 *   diff jsonb — { old: …, new: … } on UPDATE; { new: … } on INSERT; { old: … } on DELETE
 *   created_at timestamptz
 */
export interface AuditRow {
  id: number;
  actor_id: string | null;
  organization_id: string | null;
  compound_id: string | null;
  table_name: string;
  row_id: string | null;
  action: "insert" | "update" | "delete";
  diff: { old?: Record<string, unknown>; new?: Record<string, unknown> } | null;
  created_at: string;
  // Phase 12 additions (best-effort — may be null on pre-Phase-12 rows)
  actor_role: string | null;
  actor_email: string | null;
  request_id: string | null;
  client_ip: string | null;
  user_agent: string | null;
  business_action: string | null;
}

/**
 * A row from the `admin_action_log` view (Phase 12). Only audit_log rows
 * whose business_action is non-null appear here — they represent explicit
 * business operations (bill generation, payment confirmation, suspension,
 * etc.) rather than pure row-level mutations.
 */
export interface AdminActionRow {
  id: number;
  actor_id: string | null;
  actor_role: string | null;
  actor_email: string | null;
  organization_id: string | null;
  compound_id: string | null;
  target_table: string;
  target_id: string | null;
  business_action: string;
  diff: Record<string, unknown> | null;
  request_id: string | null;
  client_ip: string | null;
  user_agent: string | null;
  created_at: string;
}

interface ListOpts {
  table?: string;
  rowId?: string;
  actorId?: string;
  action?: "insert" | "update" | "delete";
  page?: number;
  pageSize?: number;
}

export async function listAuditLog(opts: ListOpts = {}): Promise<{ data: AuditRow[]; total: number }> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 25);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from("audit_log").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (opts.table)   q = q.eq("table_name", opts.table);
  if (opts.rowId)   q = q.eq("row_id", opts.rowId);
  if (opts.actorId) q = q.eq("actor_id", opts.actorId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (opts.action)  q = q.eq("action", opts.action as any);

  const { data, count, error } = await q;
  if (error) {
    console.error("[audit] list failed:", error.message);
    return { data: [], total: 0 };
  }
  return { data: (data ?? []) as unknown as AuditRow[], total: count ?? 0 };
}

/**
 * Activity timeline for a specific record. Used inline on entity detail pages.
 */
export async function getRecordActivity(table: string, rowId: string, limit = 20): Promise<AuditRow[]> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("table_name", table)
    .eq("row_id", rowId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[audit] record activity failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as AuditRow[];
}

/**
 * Phase 12 — Business-action audit log. Reads from the `admin_action_log`
 * view (a filtered projection over audit_log where business_action is set).
 *
 * Returns labelled business events like 'utility_bill_generated',
 * 'utility_bill_paid', 'service_suspended', 'meter_reading_synced', etc.
 * Compatible with old databases — if the view doesn't exist yet, returns [].
 */
export async function listAdminActions(opts: {
  businessAction?: string;
  targetTable?: string;
  targetId?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ data: AdminActionRow[]; total: number }> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 25);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("admin_action_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (opts.businessAction) q = q.eq("business_action", opts.businessAction);
  if (opts.targetTable)    q = q.eq("target_table", opts.targetTable);
  if (opts.targetId)       q = q.eq("target_id", opts.targetId);

  const { data, count, error } = await q;
  if (error) {
    // View may not exist yet on databases that haven't applied Phase 12 — soft fail.
    console.error("[audit] admin actions list failed:", error.message);
    return { data: [], total: 0 };
  }
  return { data: (data ?? []) as unknown as AdminActionRow[], total: count ?? 0 };
}

/**
 * Phase 12 — Call audit_admin_action RPC to log a labelled business event.
 * Use this when an admin performs a business operation that is not a pure
 * row mutation (e.g. waiving a penalty, manually retrying a sync job).
 */
export async function recordAdminAction(input: {
  businessAction: string;
  targetTable: string;
  targetId?: string | null;
  organizationId: string;
  compoundId?: string | null;
  reason?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("audit_admin_action", {
    p_business_action: input.businessAction,
    p_target_table:    input.targetTable,
    p_target_id:       input.targetId ?? null,
    p_organization_id: input.organizationId,
    p_compound_id:     input.compoundId ?? null,
    p_reason:          input.reason ?? null,
    p_payload:         input.payload ?? {},
  });
  if (error) throw new Error(`audit_admin_action: ${error.message}`);
}
