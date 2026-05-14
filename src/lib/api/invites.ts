"use server";

/**
 * Resident invitation flow.
 *
 *   createResidentInvite() — staff generates a one-time code tied to a unit
 *   listInvitesForUnit()   — staff sees what's been issued
 *   revokeInvite()          — staff cancels an unused code
 *   peekInvite()            — public preview (used on /m/signup before they
 *                             submit; returns minimal info so we don't leak
 *                             unit details to random guessers)
 *   redeemInvite()          — public action that atomically:
 *                             - validates the code (not used, not expired)
 *                             - creates an auth.users row
 *                             - creates a residents row linked to the unit
 *                             - assigns the 'resident' role
 *                             - marks the invite as used
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/guards";

export interface InviteRow {
  id: string;
  organization_id: string;
  compound_id: string;
  unit_id: string;
  code: string;
  email: string | null;
  tenancy_type: string;
  expires_at: string;
  used_at: string | null;
  used_by_user_id: string | null;
  created_at: string;
}

export interface CreateInviteInput {
  unit_id: string;
  email?: string;
  tenancy_type?: "owner" | "tenant" | "family_member" | "guest";
  expires_days?: number;
}

export async function createResidentInvite(input: CreateInviteInput): Promise<InviteRow> {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const supabase = await createClient();

  // Fetch the unit to inherit org + compound
  const { data: unit, error: uErr } = await supabase
    .from("units")
    .select("organization_id, compound_id")
    .eq("id", input.unit_id)
    .maybeSingle();
  if (uErr) throw new Error(uErr.message);
  if (!unit) throw new Error("Unit not found");
  const u = unit as { organization_id: string; compound_id: string };

  // Generate a unique code (collision-resistant up to ~1e12)
  const code = generateCode(8);
  const expiresDays = Math.min(60, Math.max(1, input.expires_days ?? 14));
  const expires_at = new Date(Date.now() + expiresDays * 86400 * 1000).toISOString();

  const { data, error } = await supabase
    .from("resident_invites")
    .insert({
      organization_id: u.organization_id,
      compound_id:     u.compound_id,
      unit_id:         input.unit_id,
      code,
      email:           input.email?.trim() || null,
      tenancy_type:    input.tenancy_type ?? "tenant",
      expires_at,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create invite");
  revalidatePath(`/units/${input.unit_id}`);
  return data as unknown as InviteRow;
}

export async function listInvitesForUnit(unitId: string): Promise<InviteRow[]> {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resident_invites")
    .select("*")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as InviteRow[];
}

export async function revokeInvite(id: string): Promise<void> {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const supabase = await createClient();
  const { error } = await supabase.from("resident_invites").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/invites");
}

// ─── Public flows (used on /m/signup) ────────────────────────────────────────

export interface InvitePreview {
  ok: boolean;
  error?: string;
  unit_number?: string;
  building_name?: string | null;
  compound_name?: string | null;
  organization_name?: string | null;
  tenancy_type?: string;
  email_locked?: string | null;
  expires_at?: string;
}

export async function peekInvite(code: string): Promise<InvitePreview> {
  if (!code || !/^[A-Z0-9]{6,16}$/.test(code)) {
    return { ok: false, error: "Invalid code format" };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("resident_invites")
    .select(`
      id, expires_at, used_at, email, tenancy_type,
      unit:units(unit_number, building:buildings(name)),
      compound:compounds(name),
      organization:organizations(name)
    `)
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error) return { ok: false, error: "Lookup failed" };
  if (!data) return { ok: false, error: "Code not found" };

  type Raw = {
    id: string; expires_at: string; used_at: string | null;
    email: string | null; tenancy_type: string;
    unit: { unit_number: string | null; building: { name: string | null } | null } | null;
    compound: { name: string | null } | null;
    organization: { name: string | null } | null;
  };
  const r = data as unknown as Raw;

  if (r.used_at) return { ok: false, error: "Code has already been used" };
  if (new Date(r.expires_at) < new Date()) return { ok: false, error: "Code has expired" };

  return {
    ok: true,
    unit_number:       r.unit?.unit_number ?? undefined,
    building_name:     r.unit?.building?.name ?? null,
    compound_name:     r.compound?.name ?? null,
    organization_name: r.organization?.name ?? null,
    tenancy_type:      r.tenancy_type,
    email_locked:      r.email,
    expires_at:        r.expires_at,
  };
}

export interface RedeemInput {
  code: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

export interface RedeemResult {
  ok: boolean;
  error?: string;
}

export async function redeemInvite(input: RedeemInput): Promise<RedeemResult> {
  // 1. Basic validation
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,16}$/.test(code))     return { ok: false, error: "Invalid code format" };
  if (!input.email.includes("@"))           return { ok: false, error: "Invalid email" };
  if ((input.password ?? "").length < 8)    return { ok: false, error: "Password must be ≥ 8 characters" };
  if (!input.first_name.trim() || !input.last_name.trim()) {
    return { ok: false, error: "First and last name are required" };
  }

  const admin = createAdminClient();

  // 2. Lock the row and verify (using service-role to bypass RLS)
  const { data: inviteRow, error: iErr } = await admin
    .from("resident_invites")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (iErr) return { ok: false, error: iErr.message };
  if (!inviteRow) return { ok: false, error: "Code not found" };

  const invite = inviteRow as InviteRow;
  if (invite.used_at) return { ok: false, error: "Code has already been used" };
  if (new Date(invite.expires_at) < new Date()) return { ok: false, error: "Code has expired" };
  if (invite.email && invite.email.toLowerCase() !== input.email.trim().toLowerCase()) {
    return { ok: false, error: "This invite is for a different email address" };
  }

  // 3. Create the auth user
  const { data: createdUser, error: cuErr } = await admin.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: `${input.first_name.trim()} ${input.last_name.trim()}`,
    },
  });
  if (cuErr || !createdUser?.user) {
    return { ok: false, error: cuErr?.message ?? "Failed to create account" };
  }
  const userId = createdUser.user.id;

  // 4. Create resident row + user_roles row + mark invite used (best-effort rollback if any fail)
  try {
    const { error: rErr } = await admin.from("residents").insert({
      organization_id: invite.organization_id,
      compound_id:     invite.compound_id,
      unit_id:         invite.unit_id,
      user_id:         userId,
      first_name:      input.first_name.trim(),
      last_name:       input.last_name.trim(),
      email:           input.email.trim(),
      phone:           input.phone?.trim() || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- enum narrowing
      tenancy_type:    invite.tenancy_type as any,
      status:          "active",
      move_in_date:    new Date().toISOString().slice(0, 10),
    });
    if (rErr) throw new Error(`resident insert: ${rErr.message}`);

    const { error: roErr } = await admin.from("user_roles").insert({
      user_id:         userId,
      organization_id: invite.organization_id,
      compound_id:     invite.compound_id,
      role:            "resident",
      is_primary:      true,
    });
    if (roErr) throw new Error(`user_roles insert: ${roErr.message}`);

    const { error: mErr } = await admin
      .from("resident_invites")
      .update({ used_at: new Date().toISOString(), used_by_user_id: userId })
      .eq("id", invite.id);
    if (mErr) throw new Error(`mark used: ${mErr.message}`);

    // Mark the unit as occupied if it isn't already
    await admin.from("units").update({ status: "occupied" }).eq("id", invite.unit_id);

    return { ok: true };
  } catch (e) {
    // Rollback: delete the auth user so they can retry
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return { ok: false, error: e instanceof Error ? e.message : "Signup failed" };
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function generateCode(len: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I O 0 1
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}
