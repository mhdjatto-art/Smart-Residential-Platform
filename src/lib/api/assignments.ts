"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { assignmentSchema, type AssignmentInput } from "@/lib/validations/assignment";

export interface AssignmentRow {
  id: string;
  organization_id: string;
  compound_id: string;
  unit_id: string;
  resident_id: string;
  assignment_type: string;
  status: string;
  start_date: string;
  end_date: string | null;
  monthly_rent: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function listAssignmentsByUnit(unitId: string): Promise<AssignmentRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_assignments")
    .select("*")
    .eq("unit_id", unitId)
    .order("start_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AssignmentRow[];
}

export async function listAssignmentsByResident(residentId: string): Promise<AssignmentRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_assignments")
    .select("*")
    .eq("resident_id", residentId)
    .order("start_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AssignmentRow[];
}

export async function createAssignment(input: AssignmentInput): Promise<AssignmentRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const parsed = assignmentSchema.parse(input);
  const supabase = await createClient();

  // Resolve tenant scope from the unit.
  const { data: unit, error: uErr } = await supabase
    .from("units")
    .select("*")
    .eq("id", parsed.unit_id)
    .single();
  if (uErr || !unit) throw new Error("Unit not found");
  const u = unit as { organization_id: string; compound_id: string };

  const { data, error } = await supabase
    .from("unit_assignments")
    .insert({
      organization_id: u.organization_id,
      compound_id: u.compound_id,
      unit_id: parsed.unit_id,
      resident_id: parsed.resident_id,
      assignment_type: parsed.assignment_type,
      status: parsed.status,
      start_date: parsed.start_date,
      end_date: parsed.end_date ?? null,
      monthly_rent: parsed.monthly_rent ?? null,
      notes: parsed.notes ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/units/${parsed.unit_id}`);
  revalidatePath(`/residents/${parsed.resident_id}`);
  return data as unknown as AssignmentRow;
}

export async function endAssignment(id: string, endDate: string): Promise<void> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("unit_assignments")
    .select("unit_id, resident_id")
    .eq("id", id)
    .single();
  const { error } = await supabase
    .from("unit_assignments")
    .update({ status: "ended", end_date: endDate, updated_by: user.id })
    .eq("id", id);
  if (error) throw new Error(error.message);
  const e = existing as { unit_id?: string; resident_id?: string } | null;
  if (e?.unit_id) revalidatePath(`/units/${e.unit_id}`);
  if (e?.resident_id) revalidatePath(`/residents/${e.resident_id}`);
}

export async function cancelAssignment(id: string): Promise<void> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("unit_assignments")
    .update({ status: "cancelled", updated_by: user.id })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
