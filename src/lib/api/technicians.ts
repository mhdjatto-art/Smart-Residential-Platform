"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { technicianSchema, type TechnicianInput } from "@/lib/validations/operations";

export interface TechnicianRow {
  id: string;
  organization_id: string;
  user_id: string | null;
  full_name: string;
  mobile: string | null;
  email: string | null;
  specialization: string[];
  availability_status: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export async function listTechnicians(): Promise<TechnicianRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technicians").select("*").order("full_name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TechnicianRow[];
}

export async function getTechnician(id: string): Promise<TechnicianRow | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("technicians").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as TechnicianRow) ?? null;
}

export async function createTechnician(orgId: string, input: TechnicianInput): Promise<TechnicianRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const parsed = technicianSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technicians")
    .insert({
      organization_id: orgId,
      full_name: parsed.full_name,
      mobile: parsed.mobile ?? null,
      email: parsed.email ?? null,
      specialization: parsed.specialization,
      availability_status: parsed.availability_status,
      is_active: parsed.is_active,
      notes: parsed.notes ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/technicians");
  return data as unknown as TechnicianRow;
}

export async function updateTechnician(id: string, input: Partial<TechnicianInput>): Promise<TechnicianRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const parsed = technicianSchema.partial().parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technicians")
    .update({
      ...parsed,
      mobile: parsed.mobile ?? undefined,
      email: parsed.email ?? undefined,
      notes: parsed.notes ?? undefined,
      updated_by: user.id,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/technicians");
  return data as unknown as TechnicianRow;
}
