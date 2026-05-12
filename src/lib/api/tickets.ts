"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { ticketSchema, ticketUpdateSchema, type TicketInput } from "@/lib/validations/operations";

export interface TicketRow {
  id: string;
  organization_id: string;
  compound_id: string;
  resident_id: string | null;
  unit_id: string | null;
  ticket_number: string;
  category: string;
  priority: string;
  status: string;
  subject: string;
  description: string;
  assigned_to: string | null;
  sla_due_date: string | null;
  resolution_notes: string | null;
  satisfaction_rating: number | null;
  opened_at: string;
  assigned_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ListOpts {
  status?: string;
  priority?: string;
  category?: string;
  compoundId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listTicketsPaged(opts: ListOpts = {}): Promise<{ data: TicketRow[]; total: number }> {
  await requireUser();
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 25);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from("tickets").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts.priority && opts.priority !== "all") q = q.eq("priority", opts.priority);
  if (opts.category && opts.category !== "all") q = q.eq("category", opts.category);
  if (opts.compoundId) q = q.eq("compound_id", opts.compoundId);
  if (opts.search?.trim()) {
    const term = `%${opts.search.trim()}%`;
    q = q.or(`subject.ilike.${term},description.ilike.${term},ticket_number.ilike.${term}`);
  }

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return { data: (data ?? []) as unknown as TicketRow[], total: count ?? 0 };
}

export async function getTicket(id: string): Promise<TicketRow | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("tickets").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as TicketRow) ?? null;
}

export async function createTicket(input: TicketInput): Promise<TicketRow> {
  const user = await requireUser();
  const parsed = ticketSchema.parse(input);
  const supabase = await createClient();

  const { data: compound, error: cErr } = await supabase
    .from("compounds").select("organization_id").eq("id", parsed.compound_id).single();
  if (cErr || !compound) throw new Error("Compound not found");

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      organization_id: (compound as { organization_id: string }).organization_id,
      compound_id: parsed.compound_id,
      resident_id: parsed.resident_id ?? null,
      unit_id: parsed.unit_id ?? null,
      ticket_number: "",  // trigger auto-generates
      category: parsed.category,
      subject: parsed.subject,
      description: parsed.description,
      priority: parsed.priority,
      sla_due_date: parsed.sla_due_date ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/tickets");
  return data as unknown as TicketRow;
}

export async function updateTicket(id: string, input: Record<string, unknown>): Promise<TicketRow> {
  const user = await requireUser();
  const parsed = ticketUpdateSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .update({ ...parsed, updated_by: user.id })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/tickets");
  revalidatePath(`/tickets/${id}`);
  return data as unknown as TicketRow;
}

export interface TicketCommentRow {
  id: string;
  ticket_id: string;
  author_id: string | null;
  is_internal: boolean;
  body: string;
  created_at: string;
}

export async function listComments(ticketId: string): Promise<TicketCommentRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ticket_comments").select("*").eq("ticket_id", ticketId).order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TicketCommentRow[];
}

export async function addComment(ticketId: string, body: string, isInternal: boolean): Promise<void> {
  const user = await requireUser();
  if (!body.trim()) throw new Error("Comment body required");
  const supabase = await createClient();
  const { data: t } = await supabase.from("tickets").select("organization_id").eq("id", ticketId).single();
  const orgId = (t as { organization_id?: string } | null)?.organization_id;
  if (!orgId) throw new Error("Ticket not found");

  const { error } = await supabase.from("ticket_comments").insert({
    organization_id: orgId,
    ticket_id: ticketId,
    author_id: user.id,
    is_internal: isInternal,
    body: body.trim(),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/tickets/${ticketId}`);
}

export async function assignTicket(ticketId: string, assigneeUserId: string | null): Promise<void> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "maintenance_staff"]);
  const supabase = await createClient();
  const user = await requireUser();
  const updates: Record<string, unknown> = { assigned_to: assigneeUserId, updated_by: user.id };
  if (assigneeUserId) updates.status = "assigned";
  const { error } = await supabase.from("tickets").update(updates).eq("id", ticketId);
  if (error) throw new Error(error.message);
  revalidatePath(`/tickets/${ticketId}`);
}
