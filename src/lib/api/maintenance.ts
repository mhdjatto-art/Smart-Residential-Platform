"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { maintenanceJobSchema, type MaintenanceJobInput } from "@/lib/validations/operations";

export interface MaintenanceJobRow {
  id: string;
  organization_id: string;
  compound_id: string;
  ticket_id: string | null;
  unit_id: string | null;
  building_id: string | null;
  job_number: string;
  job_type: string;
  status: string;
  title: string;
  description: string | null;
  assigned_technician_id: string | null;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  cost: number | null;
  cost_currency: string | null;
  completion_notes: string | null;
  created_at: string;
}

interface ListOpts {
  status?: string;
  jobType?: string;
  technicianId?: string;
  page?: number;
  pageSize?: number;
}

export async function listMaintenanceJobs(opts: ListOpts = {}): Promise<{ data: MaintenanceJobRow[]; total: number }> {
  await requireUser();
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 25);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from("maintenance_jobs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (opts.jobType && opts.jobType !== "all") q = q.eq("job_type", opts.jobType as any);
  if (opts.technicianId) q = q.eq("assigned_technician_id", opts.technicianId);

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return { data: (data ?? []) as unknown as MaintenanceJobRow[], total: count ?? 0 };
}

export async function createMaintenanceJob(input: MaintenanceJobInput): Promise<MaintenanceJobRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager", "maintenance_staff"]);
  const parsed = maintenanceJobSchema.parse(input);
  const supabase = await createClient();
  const { data: c, error: cErr } = await supabase
    .from("compounds").select("organization_id").eq("id", parsed.compound_id).single();
  if (cErr || !c) throw new Error("Compound not found");

  const { data, error } = await supabase
    .from("maintenance_jobs")
    .insert({
      organization_id: (c as { organization_id: string }).organization_id,
      compound_id: parsed.compound_id,
      ticket_id: parsed.ticket_id ?? null,
      unit_id: parsed.unit_id ?? null,
      building_id: parsed.building_id ?? null,
      job_number: "",
      job_type: parsed.job_type,
      title: parsed.title,
      description: parsed.description ?? null,
      assigned_technician_id: parsed.assigned_technician_id ?? null,
      scheduled_for: parsed.scheduled_for ? new Date(parsed.scheduled_for).toISOString() : null,
      cost: parsed.cost ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/maintenance");
  return data as unknown as MaintenanceJobRow;
}

export async function updateJobStatus(
  id: string,
  status: "scheduled" | "in_progress" | "on_hold" | "completed" | "cancelled",
  notes?: string,
): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const updates: Record<string, unknown> = { status, updated_by: user.id };
  if (status === "in_progress") updates.started_at = new Date().toISOString();
  if (status === "completed") {
    updates.completed_at = new Date().toISOString();
    if (notes) updates.completion_notes = notes;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial update with dynamic shape
  const { error } = await supabase.from("maintenance_jobs").update(updates as any).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${id}`);
}
