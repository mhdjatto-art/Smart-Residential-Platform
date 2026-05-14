"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { buildingSchema, type BuildingInput } from "@/lib/validations/building";

export interface BuildingRow {
  id: string;
  organization_id: string;
  compound_id: string;
  name: string;
  code: string | null;
  number_of_floors: number | null;
  total_units: number;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ListOpts {
  compoundId?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listBuildingsPaged(opts: ListOpts = {}): Promise<{ data: BuildingRow[]; total: number }> {
  await requireUser();
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 20);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from("buildings").select("*", { count: "exact" }).order("name").range(from, to);
  if (opts.compoundId) q = q.eq("compound_id", opts.compoundId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status as any);
  if (opts.search?.trim()) {
    const term = `%${opts.search.trim()}%`;
    q = q.or(`name.ilike.${term},code.ilike.${term}`);
  }

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return { data: (data ?? []) as unknown as BuildingRow[], total: count ?? 0 };
}

export async function getBuilding(id: string): Promise<BuildingRow | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("buildings").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as BuildingRow) ?? null;
}

export async function createBuilding(input: BuildingInput): Promise<BuildingRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const parsed = buildingSchema.parse(input);
  const supabase = await createClient();

  const { data: compound, error: cErr } = await supabase
    .from("compounds")
    .select("*")
    .eq("id", parsed.compound_id)
    .single();
  if (cErr || !compound) throw new Error("Compound not found");

  const { data, error } = await supabase
    .from("buildings")
    .insert({
      organization_id: (compound as { organization_id: string }).organization_id,
      compound_id: parsed.compound_id,
      name: parsed.name,
      code: parsed.code ?? null,
      number_of_floors: parsed.number_of_floors ?? null,
      description: parsed.description ?? null,
      status: parsed.status,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/buildings");
  revalidatePath(`/compounds/${parsed.compound_id}`);
  return data as unknown as BuildingRow;
}

export async function updateBuilding(id: string, input: Partial<BuildingInput>): Promise<BuildingRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const parsed = buildingSchema.partial().parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("buildings")
    .update({
      ...parsed,
      code: parsed.code ?? undefined,
      description: parsed.description ?? undefined,
      updated_by: user.id,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/buildings");
  revalidatePath(`/buildings/${id}`);
  return data as unknown as BuildingRow;
}

export async function deleteBuilding(id: string): Promise<void> {
  await requireRole(["super_admin", "developer_admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("buildings").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/buildings");
}

export async function listBuildingOptions(compoundId?: string): Promise<Array<{ id: string; name: string; compound_id: string }>> {
  await requireUser();
  const supabase = await createClient();
  let q = supabase.from("buildings").select("id, name, compound_id").order("name");
  if (compoundId) q = q.eq("compound_id", compoundId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Array<{ id: string; name: string; compound_id: string }>;
}
