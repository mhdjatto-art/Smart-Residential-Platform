"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import type { Compound, Organization } from "@/types";

export async function listOrganizations(): Promise<Organization[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").select("*").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listCompounds(opts: { organizationId?: string } = {}): Promise<Compound[]> {
  await requireUser();
  const supabase = await createClient();
  let q = supabase.from("compounds").select("*").order("name");
  if (opts.organizationId) q = q.eq("organization_id", opts.organizationId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}
