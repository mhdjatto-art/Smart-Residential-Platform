"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { residentSchema, type ResidentInput } from "@/lib/validations/resident";

export interface ResidentRow {
  id: string;
  organization_id: string;
  compound_id: string;
  unit_id: string | null;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  national_id: string | null;
  gender: string;
  date_of_birth: string | null;
  occupation: string | null;
  profile_photo_path: string | null;
  tenancy_type: string;
  status: string;
  move_in_date: string | null;
  move_out_date: string | null;
  created_at: string;
  updated_at: string;
}

interface ListOpts {
  compoundId?: string;
  status?: string;
  tenancyType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listResidentsPaged(opts: ListOpts = {}): Promise<{ data: ResidentRow[]; total: number }> {
  await requireUser();
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 25);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from("residents").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (opts.compoundId)   q = q.eq("compound_id", opts.compoundId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (opts.tenancyType && opts.tenancyType !== "all") q = q.eq("tenancy_type", opts.tenancyType as any);
  if (opts.search?.trim()) {
    const term = `%${opts.search.trim()}%`;
    q = q.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},national_id.ilike.${term},mobile.ilike.${term}`);
  }

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return { data: (data ?? []) as unknown as ResidentRow[], total: count ?? 0 };
}

export async function getResident(id: string): Promise<ResidentRow | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("residents").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as ResidentRow) ?? null;
}

export async function createResident(input: ResidentInput): Promise<ResidentRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const parsed = residentSchema.parse(input);
  const supabase = await createClient();

  const { data: compound, error: cErr } = await supabase
    .from("compounds")
    .select("*")
    .eq("id", parsed.compound_id)
    .single();
  if (cErr || !compound) throw new Error("Compound not found");
  const c = compound as { organization_id: string };

  const { data, error } = await supabase
    .from("residents")
    .insert({
      organization_id: c.organization_id,
      compound_id: parsed.compound_id,
      unit_id: null,
      first_name: parsed.first_name,
      last_name: parsed.last_name,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      mobile: parsed.mobile ?? null,
      national_id: parsed.national_id ?? null,
      gender: parsed.gender,
      date_of_birth: parsed.date_of_birth ?? null,
      occupation: parsed.occupation ?? null,
      profile_photo_path: parsed.profile_photo_path ?? null,
      tenancy_type: parsed.tenancy_type,
      status: parsed.status,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/residents");
  return data as unknown as ResidentRow;
}

export async function updateResident(id: string, input: Partial<ResidentInput>): Promise<ResidentRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const parsed = residentSchema.partial().parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("residents")
    .update({
      ...parsed,
      email: parsed.email ?? undefined,
      phone: parsed.phone ?? undefined,
      mobile: parsed.mobile ?? undefined,
      national_id: parsed.national_id ?? undefined,
      date_of_birth: parsed.date_of_birth ?? undefined,
      occupation: parsed.occupation ?? undefined,
      profile_photo_path: parsed.profile_photo_path ?? undefined,
      updated_by: user.id,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/residents");
  revalidatePath(`/residents/${id}`);
  return data as unknown as ResidentRow;
}

export async function deleteResident(id: string): Promise<void> {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const supabase = await createClient();
  const { error } = await supabase.from("residents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/residents");
}

export async function listResidentOptions(compoundId?: string): Promise<Array<{ id: string; full_name: string }>> {
  await requireUser();
  const supabase = await createClient();
  let q = supabase.from("residents").select("id, first_name, last_name").order("first_name");
  if (compoundId) q = q.eq("compound_id", compoundId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{ id: string; first_name: string; last_name: string }>).map((r) => ({
    id: r.id,
    full_name: `${r.first_name} ${r.last_name}`,
  }));
}
