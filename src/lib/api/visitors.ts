"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { visitorSchema, type VisitorInput } from "@/lib/validations/operations";

export interface VisitorRow {
  id: string;
  organization_id: string;
  compound_id: string;
  resident_id: string;
  unit_id: string | null;
  full_name: string;
  mobile: string | null;
  id_number: string | null;
  vehicle_plate: string | null;
  visitor_type: string;
  visit_purpose: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  expires_at: string | null;
  status: string;
  pass_code: string;
  approved_at: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  notes: string | null;
  created_at: string;
}

interface ListOpts {
  status?: string;
  visitorType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listVisitorsPaged(opts: ListOpts = {}): Promise<{ data: VisitorRow[]; total: number }> {
  await requireUser();
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 25);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from("visitors").select("*", { count: "exact" }).order("scheduled_date", { ascending: false }).range(from, to);
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts.visitorType && opts.visitorType !== "all") q = q.eq("visitor_type", opts.visitorType);
  if (opts.search?.trim()) {
    const term = `%${opts.search.trim()}%`;
    q = q.or(`full_name.ilike.${term},pass_code.ilike.${term},mobile.ilike.${term}`);
  }

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return { data: (data ?? []) as unknown as VisitorRow[], total: count ?? 0 };
}

export async function getVisitor(id: string): Promise<VisitorRow | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("visitors").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as VisitorRow) ?? null;
}

export async function createVisitor(input: VisitorInput): Promise<VisitorRow> {
  const user = await requireUser();
  const parsed = visitorSchema.parse(input);
  const supabase = await createClient();

  const { data: resident, error: rErr } = await supabase
    .from("residents").select("organization_id, compound_id").eq("id", parsed.resident_id).single();
  if (rErr || !resident) throw new Error("Resident not found");
  const r = resident as { organization_id: string; compound_id: string };

  const { data, error } = await supabase
    .from("visitors")
    .insert({
      organization_id: r.organization_id,
      compound_id: r.compound_id,
      resident_id: parsed.resident_id,
      unit_id: parsed.unit_id ?? null,
      full_name: parsed.full_name,
      mobile: parsed.mobile ?? null,
      id_number: parsed.id_number ?? null,
      vehicle_plate: parsed.vehicle_plate ?? null,
      visitor_type: parsed.visitor_type,
      visit_purpose: parsed.visit_purpose ?? null,
      scheduled_date: parsed.scheduled_date,
      scheduled_time: parsed.scheduled_time ?? null,
      notes: parsed.notes ?? null,
      pass_code: "",  // trigger generates
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/visitors");
  return data as unknown as VisitorRow;
}

export async function approveVisitor(id: string): Promise<void> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager", "security_staff"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("visitors")
    .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: user.id, updated_by: user.id })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/visitors");
}

export async function rejectVisitor(id: string): Promise<void> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager", "security_staff"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("visitors")
    .update({ status: "rejected", updated_by: user.id })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/visitors");
}

export async function checkIn(id: string): Promise<void> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager", "security_staff"]);
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("visitors").select("organization_id, compound_id, status").eq("id", id).single();
  if (!v) throw new Error("Visitor not found");
  const cur = v as { organization_id: string; compound_id: string; status: string };
  if (cur.status !== "approved") throw new Error("Visitor must be approved before check-in");

  const { error } = await supabase
    .from("visitors")
    .update({ status: "checked_in", checked_in_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.from("security_logs").insert({
    organization_id: cur.organization_id,
    compound_id: cur.compound_id,
    visitor_id: id,
    action: "check_in",
    officer_id: user.id,
  });

  revalidatePath("/visitors");
  revalidatePath(`/visitors/${id}`);
}

export async function checkOut(id: string): Promise<void> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager", "security_staff"]);
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("visitors").select("organization_id, compound_id").eq("id", id).single();
  if (!v) throw new Error("Visitor not found");
  const cur = v as { organization_id: string; compound_id: string };

  const { error } = await supabase
    .from("visitors")
    .update({ status: "checked_out", checked_out_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.from("security_logs").insert({
    organization_id: cur.organization_id,
    compound_id: cur.compound_id,
    visitor_id: id,
    action: "check_out",
    officer_id: user.id,
  });

  revalidatePath("/visitors");
  revalidatePath(`/visitors/${id}`);
}
