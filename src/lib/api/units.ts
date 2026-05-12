"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { unitSchema, type UnitInput } from "@/lib/validations/unit";

export interface UnitRow {
  id: string;
  organization_id: string;
  compound_id: string;
  building_id: string;
  floor_id: string | null;
  unit_number: string;
  unit_type: string;
  status: string;
  ownership_status: string;
  floor: number | null;
  area_sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_slots: number;
  purchase_price: number | null;
  rent_price: number | null;
  maintenance_fee: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface ListOpts {
  compoundId?: string;
  buildingId?: string;
  status?: string;
  unitType?: string;
  ownershipStatus?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listUnitsPaged(opts: ListOpts = {}): Promise<{ data: UnitRow[]; total: number }> {
  await requireUser();
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 25);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from("units").select("*", { count: "exact" }).order("unit_number").range(from, to);
  if (opts.compoundId)       q = q.eq("compound_id", opts.compoundId);
  if (opts.buildingId)       q = q.eq("building_id", opts.buildingId);
  if (opts.status && opts.status !== "all")           q = q.eq("status", opts.status);
  if (opts.unitType && opts.unitType !== "all")       q = q.eq("unit_type", opts.unitType);
  if (opts.ownershipStatus && opts.ownershipStatus !== "all") q = q.eq("ownership_status", opts.ownershipStatus);
  if (opts.search?.trim())   q = q.ilike("unit_number", `%${opts.search.trim()}%`);

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return { data: (data ?? []) as unknown as UnitRow[], total: count ?? 0 };
}

export async function getUnit(id: string): Promise<UnitRow | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("units").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as UnitRow) ?? null;
}

export async function createUnit(input: UnitInput): Promise<UnitRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const parsed = unitSchema.parse(input);
  const supabase = await createClient();

  const { data: building, error: bErr } = await supabase
    .from("buildings")
    .select("*")
    .eq("id", parsed.building_id)
    .single();
  if (bErr || !building) throw new Error("Building not found");
  const b = building as { organization_id: string; compound_id: string };

  const { data, error } = await supabase
    .from("units")
    .insert({
      organization_id: b.organization_id,
      compound_id: b.compound_id,
      building_id: parsed.building_id,
      floor_id: parsed.floor_id ?? null,
      unit_number: parsed.unit_number,
      unit_type: parsed.unit_type,
      status: parsed.status,
      ownership_status: parsed.ownership_status,
      floor: parsed.floor ?? null,
      area_sqm: parsed.area_sqm ?? null,
      bedrooms: parsed.bedrooms ?? null,
      bathrooms: parsed.bathrooms ?? null,
      parking_slots: parsed.parking_slots ?? 0,
      purchase_price: parsed.purchase_price ?? null,
      rent_price: parsed.rent_price ?? null,
      maintenance_fee: parsed.maintenance_fee ?? null,
      description: parsed.description ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/units");
  revalidatePath(`/buildings/${parsed.building_id}`);
  return data as unknown as UnitRow;
}

export async function updateUnit(id: string, input: Partial<UnitInput>): Promise<UnitRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const parsed = unitSchema.partial().parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("units")
    .update({
      ...parsed,
      floor_id: parsed.floor_id ?? undefined,
      area_sqm: parsed.area_sqm ?? undefined,
      bedrooms: parsed.bedrooms ?? undefined,
      bathrooms: parsed.bathrooms ?? undefined,
      parking_slots: parsed.parking_slots ?? undefined,
      purchase_price: parsed.purchase_price ?? undefined,
      rent_price: parsed.rent_price ?? undefined,
      maintenance_fee: parsed.maintenance_fee ?? undefined,
      description: parsed.description ?? undefined,
      updated_by: user.id,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/units");
  revalidatePath(`/units/${id}`);
  return data as unknown as UnitRow;
}

export async function deleteUnit(id: string): Promise<void> {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const supabase = await createClient();
  const { error } = await supabase.from("units").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/units");
}
