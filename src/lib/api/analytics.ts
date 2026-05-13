"use server";

/**
 * Phase 8 analytics — executive, financial, utility, ops, marketplace, resident.
 *
 * All reads come from `analytics_daily_kpi` and pre-aggregated SQL functions
 * where possible. We never run heavy aggregations directly against transactional
 * tables from the frontend (Module 14 — Data Architecture Optimization).
 */

import { createClient } from "@/lib/supabase/server";
import { requireRole, requireUser } from "@/lib/auth/guards";

export interface DailyKpiRow {
  id: string;
  organization_id: string;
  compound_id: string | null;
  kpi_date: string;
  active_residents: number;
  occupancy_rate: number;
  outstanding_balance: number;
  collections_today: number;
  collections_mtd: number;
  overdue_amount: number;
  overdue_count: number;
  utility_bills_unpaid: number;
  utility_amount_unpaid: number;
  active_tickets: number;
  sla_breached: number;
  pending_visitors: number;
  marketplace_orders_open: number;
  marketplace_revenue_today: number;
  marketplace_commission_today: number;
  satisfaction_avg: number;
  currency: string;
  computed_at: string;
}

export interface ExecutiveSnapshot {
  org_id: string | null;
  currency: string;
  kpi_date: string | null;
  latest: DailyKpiRow | null;
  prior: DailyKpiRow | null;
  trend_days: DailyKpiRow[];
}

export async function getExecutiveSnapshot(): Promise<ExecutiveSnapshot> {
  const user = await requireRole(["super_admin","developer_admin","compound_manager","finance_officer","maintenance_staff","security_staff"]);
  const supabase = await createClient();
  const orgId = user.organizationIds[0] ?? null;
  if (!orgId) {
    return { org_id: null, currency: "USD", kpi_date: null, latest: null, prior: null, trend_days: [] };
  }

  const { data: trendData } = await supabase
    .from("analytics_daily_kpi")
    .select("*")
    .eq("organization_id", orgId)
    .is("compound_id", null)
    .order("kpi_date", { ascending: false })
    .limit(30);

  const trend = (trendData ?? []) as unknown as DailyKpiRow[];
  const latest = trend[0] ?? null;
  const prior  = trend[1] ?? null;
  return {
    org_id: orgId,
    currency: latest?.currency ?? "USD",
    kpi_date: latest?.kpi_date ?? null,
    latest,
    prior,
    trend_days: trend.reverse(), // oldest → newest for charting
  };
}

export async function refreshExecutiveSnapshot(): Promise<void> {
  const user = await requireRole(["super_admin","developer_admin","compound_manager","finance_officer"]);
  const supabase = await createClient();
  const orgId = user.organizationIds[0];
  if (!orgId && !user.isSuperAdmin) throw new Error("No organization in scope");
  if (orgId) {
    const { error } = await supabase.rpc("refresh_daily_kpi", { p_org_id: orgId, p_kpi_date: new Date().toISOString().slice(0,10) });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.rpc("refresh_all_daily_kpi", { p_kpi_date: new Date().toISOString().slice(0,10) });
    if (error) throw new Error(error.message);
  }
}

// ─── Predictions / risk ────────────────────────────────────────────────────

export interface OverdueRiskRow {
  id: string;
  subject_id: string;
  resident_name: string | null;
  score: number;
  band: string | null;
  rationale: Record<string, unknown>;
  predicted_at: string;
}

export async function listOverdueRisk(): Promise<OverdueRiskRow[]> {
  await requireRole(["super_admin","developer_admin","compound_manager","finance_officer"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_predictions")
    .select("id,subject_id,score,band,rationale,predicted_at,subject:residents(first_name,last_name)")
    .eq("prediction_kind", "overdue_risk")
    .order("score", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[listOverdueRisk] failed:", error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => {
    const composed = r.subject
      ? [r.subject.first_name, r.subject.last_name].filter(Boolean).join(" ") || null
      : null;
    return {
      id: r.id,
      subject_id: r.subject_id,
      resident_name: composed,
      score: Number(r.score),
      band: r.band,
      rationale: r.rationale ?? {},
      predicted_at: r.predicted_at,
    };
  });
}

export async function recomputeOverdueRisk(): Promise<number> {
  const user = await requireRole(["super_admin","developer_admin","compound_manager","finance_officer"]);
  const supabase = await createClient();
  const orgId = user.organizationIds[0];
  if (!orgId) return 0;
  const { data, error } = await supabase.rpc("compute_overdue_risk_for_org", { p_org_id: orgId });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

// ─── Alerts ───────────────────────────────────────────────────────────────

export interface SystemAlertRow {
  id: string;
  kind: string;
  severity: string;
  status: string;
  title: string;
  body: string | null;
  entity_table: string | null;
  entity_id: string | null;
  metric: Record<string, unknown>;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

export async function listAlerts(statusFilter: string[] = ["open","acknowledged"]): Promise<SystemAlertRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_alerts").select("*")
    .in("status", statusFilter)
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SystemAlertRow[];
}

export async function updateAlertStatus(id: string, status: "open"|"acknowledged"|"resolved"|"snoozed"): Promise<void> {
  const user = await requireRole(["super_admin","developer_admin","compound_manager","finance_officer"]);
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "acknowledged") {
    patch.acknowledged_at = new Date().toISOString();
    patch.acknowledged_by = user.id;
  }
  if (status === "resolved") {
    patch.resolved_at = new Date().toISOString();
    patch.resolved_by = user.id;
  }
  const { error } = await supabase.from("system_alerts").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Audit log ─────────────────────────────────────────────────────────────

export interface AuditRow {
  id: number;
  actor_id: string | null;
  organization_id: string | null;
  table_name: string;
  row_id: string | null;
  action: string;
  diff: unknown;
  created_at: string;
}

export interface AuditFilters {
  table?: string;
  action?: string;
  search?: string;
  limit?: number;
}

export async function listAuditEntries(filters: AuditFilters = {}): Promise<AuditRow[]> {
  await requireRole(["super_admin","developer_admin","compound_manager","finance_officer"]);
  const supabase = await createClient();
  let q = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(filters.limit ?? 200);
  if (filters.table)  q = q.eq("table_name", filters.table);
  if (filters.action) q = q.eq("action", filters.action);
  if (filters.search) q = q.ilike("table_name", `%${filters.search}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AuditRow[];
}
