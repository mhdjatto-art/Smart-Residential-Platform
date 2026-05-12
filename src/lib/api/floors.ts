"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { floorSchema, type FloorInput } from "@/lib/validations/floor";

export interface FloorRow {
  id: string;
  organization_id: string;
  compound_id: string;
  building_id: string;
  floor_number: number;
  floor_name: string | null;
  total_units: number;
  created_at: string;
  updated_at: string;
}

export async function listFloors(buildingId: string): Promise<FloorRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("floors")
    .select("*")
    .eq("building_id", buildingId)
    .order("floor_number");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FloorRow[];
}

export async function createFloor(input: FloorInput): Promise<FloorRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const parsed = floorSchema.parse(input);
  const supabase = await createClient();

  const { data: building, error: bErr } = await supabase
    .from("buildings")
    .select("*")
    .eq("id", parsed.building_id)
    .single();
  if (bErr || !building) throw new Error("Building not found");
  const b = building as { organization_id: string; compound_id: string };

  const { data, error } = await supabase
    .from("floors")
    .insert({
      organization_id: b.organization_id,
      compound_id: b.compound_id,
      building_id: parsed.building_id,
      floor_number: parsed.floor_number,
      floor_name: parsed.floor_name ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/buildings/${parsed.building_id}`);
  return data as unknown as FloorRow;
}

export async function deleteFloor(id: string): Promise<void> {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const supabase = await createClient();
  const { data: floor } = await supabase.from("floors").select("building_id").eq("id", id).single();
  const { error } = await supabase.from("floors").delete().eq("id", id);
  if (error) throw new Error(error.message);
  const bId = (floor as { building_id?: string } | null)?.building_id;
  if (bId) revalidatePath(`/buildings/${bId}`);
}

export async function listFloorOptions(buildingId: string): Promise<Array<{ id: string; label: string }>> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("floors")
    .select("id, floor_number, floor_name")
    .eq("building_id", buildingId)
    .order("floor_number");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{ id: string; floor_number: number; floor_name: string | null }>).map((f) => ({
    id: f.id,
    label: f.floor_name ? `${f.floor_name} (Floor ${f.floor_number})` : `Floor ${f.floor_number}`,
  }));
}
