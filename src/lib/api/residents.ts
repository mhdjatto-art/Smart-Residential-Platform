/**
 * Server actions / data functions for residents.
 *
 * The centralized API surface every Server Component and Server Action goes
 * through. RLS is the actual gate, but these helpers:
 *   - Throw typed errors that pages can catch
 *   - Validate input with Zod before talking to the DB
 *   - Stamp `created_by` / `updated_by` consistently
 *   - Resolve tenant scope (organization_id / compound_id) from the unit so
 *     callers don't pass it manually and risk drift
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { residentSchema } from "@/lib/validations/resident";
import type { Resident } from "@/types";

export async function listResidents(opts: {
  compoundId?: string;
  search?: string;
  limit?: number;
}): Promise<Resident[]> {
  await requireUser();
  const supabase = await createClient();

  let q = supabase
    .from("residents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.compoundId) q = q.eq("compound_id", opts.compoundId);
  if (opts.search && opts.search.trim()) {
    const term = `%${opts.search.trim()}%`;
    q = q.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getResident(id: string): Promise<Resident | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("residents").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

const createInputSchema = residentSchema;

export async function createResident(input: z.infer<typeof createInputSchema>): Promise<Resident> {
  const user = await requireUser();
  const parsed = createInputSchema.parse(input);
  const supabase = await createClient();

  // Resolve org + compound from the chosen unit so the caller can't lie.
  const { data: unit, error: unitError } = await supabase
    .from("units")
    .select("organization_id, compound_id")
    .eq("id", parsed.unit_id)
    .single();
  if (unitError || !unit) throw new Error("Unit not found");

  const { data, error } = await supabase
    .from("residents")
    .insert({
      organization_id: unit.organization_id,
      compound_id: unit.compound_id,
      unit_id: parsed.unit_id,
      first_name: parsed.first_name,
      last_name: parsed.last_name,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      tenancy_type: parsed.tenancy_type,
      status: parsed.status,
      move_in_date: parsed.move_in_date ?? null,
      move_out_date: parsed.move_out_date ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/residents");
  return data;
}

export async function updateResident(
  id: string,
  input: Partial<z.infer<typeof createInputSchema>>,
): Promise<Resident> {
  const user = await requireUser();
  const supabase = await createClient();
  const parsed = createInputSchema.partial().parse(input);

  const { data, error } = await supabase
    .from("residents")
    .update({
      ...parsed,
      email: parsed.email ?? undefined,
      phone: parsed.phone ?? undefined,
      move_in_date: parsed.move_in_date ?? undefined,
      move_out_date: parsed.move_out_date ?? undefined,
      updated_by: user.id,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/residents");
  revalidatePath(`/residents/${id}`);
  return data;
}

export async function deleteResident(id: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("residents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/residents");
}
