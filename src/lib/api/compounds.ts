"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { compoundSchema, type CompoundInput } from "@/lib/validations/compound";

interface ListOpts {
  organizationId?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CompoundRow {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  code: string | null;
  description: string | null;
  status: string;
  city: string | null;
  region: string | null;
  country_code: string | null;
  total_buildings: number;
  total_units: number;
  logo_path: string | null;
  created_at: string;
  updated_at: string;
}

export async function listCompoundsPaged(opts: ListOpts = {}): Promise<{ data: CompoundRow[]; total: number }> {
  await requireUser();
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 20);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from("compounds").select("*", { count: "exact" }).order("name").range(from, to);
  if (opts.organizationId) q = q.eq("organization_id", opts.organizationId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status as any);
  if (opts.search?.trim()) {
    const term = `%${opts.search.trim()}%`;
    q = q.or(`name.ilike.${term},slug.ilike.${term},city.ilike.${term},code.ilike.${term}`);
  }

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return { data: (data ?? []) as unknown as CompoundRow[], total: count ?? 0 };
}

export async function getCompound(id: string): Promise<CompoundRow | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("compounds").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as CompoundRow) ?? null;
}

export async function createCompound(input: CompoundInput): Promise<CompoundRow> {
  const user = await requireRole(["super_admin", "developer_admin"]);
  const parsed = compoundSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("compounds")
    .insert({
      organization_id: parsed.organization_id,
      name: parsed.name,
      slug: parsed.slug,
      code: parsed.code ?? null,
      description: parsed.description ?? null,
      status: parsed.status,
      address_line1: parsed.address_line1 ?? null,
      address_line2: parsed.address_line2 ?? null,
      city: parsed.city ?? null,
      region: parsed.region ?? null,
      country_code: parsed.country_code ?? null,
      postal_code: parsed.postal_code ?? null,
      timezone: parsed.timezone,
      logo_path: parsed.logo_path ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/compounds");
  return data as unknown as CompoundRow;
}

export async function updateCompound(id: string, input: Partial<CompoundInput>): Promise<CompoundRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const parsed = compoundSchema.partial().parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("compounds")
    .update({
      ...parsed,
      code: parsed.code ?? undefined,
      description: parsed.description ?? undefined,
      address_line1: parsed.address_line1 ?? undefined,
      address_line2: parsed.address_line2 ?? undefined,
      city: parsed.city ?? undefined,
      region: parsed.region ?? undefined,
      country_code: parsed.country_code ?? undefined,
      postal_code: parsed.postal_code ?? undefined,
      updated_by: user.id,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/compounds");
  revalidatePath(`/compounds/${id}`);
  return data as unknown as CompoundRow;
}

export async function deleteCompound(id: string): Promise<void> {
  await requireRole(["super_admin", "developer_admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("compounds").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/compounds");
}

/** Lightweight list for dropdowns. */
export async function listCompoundOptions(organizationId?: string): Promise<Array<{ id: string; name: string }>> {
  await requireUser();
  const supabase = await createClient();
  let q = supabase.from("compounds").select("id, name").order("name");
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Array<{ id: string; name: string }>;
}
