"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";

export interface ContractTemplate {
  id: string;
  organization_id: string | null;
  kind: string;
  name: string;
  locale: string;
  body_html: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

/**
 * List all active templates the current user can see. The RLS policy on
 * contract_templates already restricts visibility (org-scoped templates only
 * to members of that org), so we just filter by `is_active` here.
 */
export async function listContractTemplates(opts: { kind?: string; locale?: string } = {}): Promise<ContractTemplate[]> {
  await requireUser();
  const supabase = await createClient();
  let q = supabase.from("contract_templates").select("*").eq("is_active", true).order("is_default", { ascending: false }).order("name");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (opts.kind) q = q.eq("kind", opts.kind as any);
  if (opts.locale) q = q.eq("locale", opts.locale);
  const { data, error } = await q;
  if (error) {
    logger.error("contract-templates", "list failed", error);
    return [];
  }
  return (data ?? []) as unknown as ContractTemplate[];
}

export async function getContractTemplate(id: string): Promise<ContractTemplate | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("contract_templates").select("*").eq("id", id).maybeSingle();
  if (error) return null;
  return (data as unknown as ContractTemplate) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderer
// ─────────────────────────────────────────────────────────────────────────────

interface RenderContext {
  contract: Record<string, unknown>;
  unit: Record<string, unknown>;
  building: Record<string, unknown>;
  compound: Record<string, unknown>;
  organization: Record<string, unknown>;
  resident: Record<string, unknown>;
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    // Format numbers with thousands separators, drop trailing .00
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

/**
 * Replace `{{a.b.c}}` placeholders in `html` with values from `ctx`.
 * Whitespace inside the braces is tolerated.
 */
export async function renderTemplate(html: string, ctx: RenderContext): Promise<string> {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const [root, ...rest] = path.split(".");
    if (!root) return "—";
    const obj = (ctx as unknown as Record<string, Record<string, unknown>>)[root];
    if (!obj) return "—";
    const v = rest.length === 0 ? obj : getPath(obj, rest.join("."));
    return formatValue(v);
  });
}

/**
 * Fetches a contract + every related entity and renders the given template.
 * Returns the final HTML string ready to drop into a printable page.
 */
export async function renderContract(contractId: string, templateId: string): Promise<{
  html: string;
  template: ContractTemplate;
  contract: Record<string, unknown>;
  unit: Record<string, unknown>;
  resident: Record<string, unknown>;
  compound: Record<string, unknown>;
}> {
  await requireUser();
  const supabase = await createClient();

  const template = await getContractTemplate(templateId);
  if (!template) throw new Error("Template not found");

  const { data: contract, error: cErr } = await supabase
    .from("installment_contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();
  if (cErr || !contract) throw new Error("Contract not found");
  const c = contract as Record<string, unknown>;

  const [unitRes, buildingRes, compoundRes, orgRes, residentRes] = await Promise.all([
    supabase.from("units").select("*").eq("id", c.unit_id as string).maybeSingle(),
    (async () => {
      const unitId = c.unit_id as string;
      const { data: u } = await supabase.from("units").select("building_id").eq("id", unitId).maybeSingle();
      const buildingId = (u as { building_id?: string } | null)?.building_id;
      if (!buildingId) return { data: null };
      return supabase.from("buildings").select("*").eq("id", buildingId).maybeSingle();
    })(),
    supabase.from("compounds").select("*").eq("id", c.compound_id as string).maybeSingle(),
    supabase.from("organizations").select("*").eq("id", c.organization_id as string).maybeSingle(),
    supabase.from("residents").select("*").eq("id", c.resident_id as string).maybeSingle(),
  ]);

  // Build a full_name convenience field on the resident.
  const r = (residentRes.data ?? {}) as Record<string, unknown>;
  const fullName = `${(r.first_name as string) ?? ""} ${(r.last_name as string) ?? ""}`.trim();
  const residentCtx = { ...r, full_name: fullName || "—" };

  // Default contract fields that may be null
  const contractCtx = {
    ...c,
    currency: c.currency ?? "IQD",
    contract_end_date: c.contract_end_date ?? "—",
    late_penalty_type: c.late_penalty_type ?? "—",
    late_penalty_value: c.late_penalty_value ?? 0,
  };

  const ctx: RenderContext = {
    contract: contractCtx,
    unit: (unitRes.data ?? {}) as Record<string, unknown>,
    building: (buildingRes.data ?? {}) as Record<string, unknown>,
    compound: (compoundRes.data ?? {}) as Record<string, unknown>,
    organization: (orgRes.data ?? {}) as Record<string, unknown>,
    resident: residentCtx,
  };

  const html = await renderTemplate(template.body_html, ctx);

  return {
    html,
    template,
    contract: contractCtx,
    unit: ctx.unit,
    resident: ctx.resident,
    compound: ctx.compound,
  };
}
