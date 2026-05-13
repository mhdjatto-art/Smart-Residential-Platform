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
  // Joined for display (best-effort)
  actor_email?: string | null;
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
  if (opts.action)  q = q.eq("action", opts.action);

  const { data, count, error } = await q;
  if (error) {
    console.error("[audit] list failed:", error.message);
    return { data: [], total: 0 };
  }
  return { data: (data ?? []) as unknown as AuditRow[], total: count ?? 0 };
}

/**
 * Returns the keys that changed on an UPDATE row, ignoring volatile metadata.
 */
export function diffKeys(diff: AuditRow["diff"]): string[] {
  if (!diff?.old || !diff?.new) return [];
  const out: string[] = [];
  const all = new Set([...Object.keys(diff.old), ...Object.keys(diff.new)]);
  for (const k of all) {
    if (k === "updated_at" || k === "created_at") continue;
    const a = diff.old[k];
    const b = diff.new[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(k);
  }
  return out;
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
