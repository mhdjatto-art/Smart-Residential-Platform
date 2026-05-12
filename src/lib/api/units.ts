"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { unitSchema, type UnitInput } from "@/lib/validations/unit";
import type { Unit } from "@/types";

export async function listUnits(opts: { compoundId?: string; buildingId?: string; limit?: number } = {}): Promise<Unit[]> {
  await requireUser();
  const supabase = await createClient();
  let q = supabase.from("units").select("*").order("unit_number").limit(opts.limit ?? 200);
  if (opts.compoundId) q = q.eq("compound_id", opts.compoundId);
  if (opts.buildingId) q = q.eq("building_id", opts.buildingId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createUnit(input: UnitInput): Promise<Unit> {
  const user = await requireUser();
  const parsed = unitSchema.parse(input);
  const supabase = await createClient();

  const { data: building, error: bErr } = await supabase
    .from("buildings")
    .select("organization_id, compound_id")
    .eq("id", parsed.building_id)
    .single();
  if (bErr || !building) throw new Error("Building not found");

  const { data, error } = await supabase
    .from("units")
    .insert({
      organization_id: building.organization_id,
      compound_id: building.compound_id,
      building_id: parsed.building_id,
      unit_number: parsed.unit_number,
      unit_type: parsed.unit_type,
      status: parsed.status,
      floor: parsed.floor ?? null,
      area_sqm: parsed.area_sqm ?? null,
      bedrooms: parsed.bedrooms ?? null,
      bathrooms: parsed.bathrooms ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/units");
  return data;
}
