"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { buildingSchema, type BuildingInput } from "@/lib/validations/building";
import type { Building } from "@/types";

export async function listBuildings(opts: { compoundId?: string } = {}): Promise<Building[]> {
  await requireUser();
  const supabase = await createClient();
  let q = supabase.from("buildings").select("*").order("name");
  if (opts.compoundId) q = q.eq("compound_id", opts.compoundId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createBuilding(input: BuildingInput): Promise<Building> {
  const user = await requireUser();
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
      organization_id: compound.organization_id,
      compound_id: parsed.compound_id,
      name: parsed.name,
      code: parsed.code ?? null,
      floors: parsed.floors ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/buildings");
  return data;
}
