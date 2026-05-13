"use server";

/**
 * Admin: user + role management.
 *
 * Lists every auth user with their current role rows, and lets a super_admin
 * grant or revoke roles (scoped to org / compound / nothing for super_admin).
 *
 * Uses the service-role admin client to read auth.users, then RLS-trusted
 * supabase client for user_roles writes (which must satisfy the RLS policy
 * that super_admin can write any row).
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import type { AppRole } from "@/types";

export interface AdminUserRow {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  full_name: string | null;
  roles: Array<{
    id: string;
    role: AppRole;
    organization_id: string | null;
    organization_name: string | null;
    compound_id: string | null;
    compound_name: string | null;
    is_primary: boolean;
  }>;
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  await requireRole(["super_admin"]);
  const admin = createAdminClient();

  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);

  const userIds = list.users.map((u) => u.id);
  if (userIds.length === 0) return [];

  const [{ data: roles }, { data: orgs }, { data: compounds }] = await Promise.all([
    admin.from("user_roles").select("id,user_id,role,organization_id,compound_id,is_primary").in("user_id", userIds),
    admin.from("organizations").select("id,name"),
    admin.from("compounds").select("id,name"),
  ]);

  const orgName = new Map<string, string>();
  for (const o of (orgs ?? []) as Array<{ id: string; name: string }>) orgName.set(o.id, o.name);
  const compName = new Map<string, string>();
  for (const c of (compounds ?? []) as Array<{ id: string; name: string }>) compName.set(c.id, c.name);

  const byUser = new Map<string, AdminUserRow["roles"]>();
  for (const r of (roles ?? []) as Array<{
    id: string; user_id: string; role: AppRole;
    organization_id: string | null; compound_id: string | null; is_primary: boolean;
  }>) {
    const arr = byUser.get(r.user_id) ?? [];
    arr.push({
      id: r.id,
      role: r.role,
      organization_id: r.organization_id,
      organization_name: r.organization_id ? orgName.get(r.organization_id) ?? null : null,
      compound_id: r.compound_id,
      compound_name: r.compound_id ? compName.get(r.compound_id) ?? null : null,
      is_primary: r.is_primary,
    });
    byUser.set(r.user_id, arr);
  }

  return list.users
    .map((u) => {
      // banned_until is exposed on the GoTrue user record; some SDK versions
      // type it loosely so we read through unknown.
      const raw = u as unknown as { banned_until?: string | null; email_confirmed_at?: string | null };
      return {
        id: u.id,
        email: u.email ?? null,
        phone: u.phone ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: raw.email_confirmed_at ?? null,
        banned_until: raw.banned_until ?? null,
        full_name: (u.user_metadata as { full_name?: string } | undefined)?.full_name ?? null,
        roles: byUser.get(u.id) ?? [],
      };
    })
    .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
}

export interface OrgOption { id: string; name: string }
export interface CompoundOption { id: string; name: string; organization_id: string }

export async function listOrgOptions(): Promise<OrgOption[]> {
  await requireRole(["super_admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").select("id,name").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as OrgOption[];
}

export async function listCompoundOptions(): Promise<CompoundOption[]> {
  await requireRole(["super_admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("compounds")
    .select("id,name,organization_id")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as CompoundOption[];
}

export interface GrantRoleInput {
  user_id: string;
  role: AppRole;
  organization_id?: string | null;
  compound_id?: string | null;
  is_primary?: boolean;
}

export async function grantRole(input: GrantRoleInput): Promise<void> {
  await requireRole(["super_admin"]);
  const supabase = await createClient();
  const scope =
    input.role === "super_admin"
      ? { organization_id: null, compound_id: null }
      : { organization_id: input.organization_id ?? null, compound_id: input.compound_id ?? null };

  if (input.role !== "super_admin" && !scope.organization_id) {
    throw new Error("Non-super-admin roles require an organization");
  }

  const { error } = await supabase.from("user_roles").insert({
    user_id: input.user_id,
    role: input.role,
    organization_id: scope.organization_id,
    compound_id: scope.compound_id,
    is_primary: input.is_primary ?? false,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

export async function revokeRole(role_row_id: string): Promise<void> {
  await requireRole(["super_admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("user_roles").delete().eq("id", role_row_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

export async function setPrimaryRole(role_row_id: string, user_id: string): Promise<void> {
  await requireRole(["super_admin"]);
  const supabase = await createClient();
  // Clear other primaries for this user
  const { error: e1 } = await supabase.from("user_roles").update({ is_primary: false }).eq("user_id", user_id);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await supabase.from("user_roles").update({ is_primary: true }).eq("id", role_row_id);
  if (e2) throw new Error(e2.message);
  revalidatePath("/admin/users");
}

export interface CreateUserInput {
  email: string;
  password: string;
  full_name?: string;
}

export async function createAuthUser(input: CreateUserInput): Promise<string> {
  await requireRole(["super_admin"]);
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: input.full_name ? { full_name: input.full_name } : undefined,
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message ?? "no user returned"}`);
  revalidatePath("/admin/users");
  return data.user.id;
}

export async function resetUserPassword(user_id: string, new_password: string): Promise<void> {
  await requireRole(["super_admin"]);
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user_id, { password: new_password });
  if (error) throw new Error(error.message);
}

export async function deleteAuthUser(user_id: string): Promise<void> {
  await requireRole(["super_admin"]);
  const admin = createAdminClient();
  // Cascade roles first
  await admin.from("user_roles").delete().eq("user_id", user_id);
  const { error } = await admin.auth.admin.deleteUser(user_id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

// ─────────────────────────────────────────────────────────────────────────────
// Advanced user controls
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a strong random password. 16 chars from a curated set that avoids
 * visually-similar glyphs (no 0/O, 1/l/I) for safer hand-off via paper or chat.
 */
export async function generateStrongPassword(): Promise<string> {
  // Server action — must be async to be callable from client components.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*";
  const arr = new Uint32Array(16);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < arr.length; i++) out += alphabet[arr[i]! % alphabet.length];
  return out;
}

/**
 * Lock a user out of the application for a duration.
 *
 * Supabase Auth supports a `ban_duration` field on updateUserById. Pass a
 * value like "24h" or "365d" — use "none" to unban.
 */
export async function setUserBan(user_id: string, ban_duration: string): Promise<void> {
  await requireRole(["super_admin"]);
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.auth.admin as any).updateUserById(user_id, { ban_duration });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

export async function lockUser(user_id: string, durationHours = 24 * 365): Promise<void> {
  await setUserBan(user_id, `${durationHours}h`);
}

export async function unlockUser(user_id: string): Promise<void> {
  await setUserBan(user_id, "none");
}

/**
 * Set a flag in user_metadata that the login flow can read to force a
 * password change on next sign-in. The middleware/login page should redirect
 * to /change-password when this is true.
 */
export async function forcePasswordChange(user_id: string, value = true): Promise<void> {
  await requireRole(["super_admin"]);
  const admin = createAdminClient();
  const { data: existing } = await admin.auth.admin.getUserById(user_id);
  const meta = (existing?.user?.user_metadata ?? {}) as Record<string, unknown>;
  const { error } = await admin.auth.admin.updateUserById(user_id, {
    user_metadata: { ...meta, must_change_password: value },
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

/**
 * Send Supabase's built-in password-reset email. Uses the recovery flow so
 * the user clicks a magic link and sets a new password themselves —
 * preferable to handing them a temp password in plaintext.
 *
 * Requires SUPABASE_URL and a configured email provider in the project.
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  await requireRole(["super_admin"]);
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (admin.auth as any).resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/reset-password`,
  });
  if (result?.error) throw new Error(result.error.message);
}

/** Change a user's email. The new address is set immediately + confirmed. */
export async function updateUserEmail(user_id: string, email: string): Promise<void> {
  await requireRole(["super_admin"]);
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user_id, { email, email_confirm: true });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

/** Update arbitrary user_metadata (full_name, locale preferences, etc.) */
export async function updateUserMetadata(user_id: string, metadata: Record<string, unknown>): Promise<void> {
  await requireRole(["super_admin"]);
  const admin = createAdminClient();
  const { data: existing } = await admin.auth.admin.getUserById(user_id);
  const existingMeta = (existing?.user?.user_metadata ?? {}) as Record<string, unknown>;
  const { error } = await admin.auth.admin.updateUserById(user_id, {
    user_metadata: { ...existingMeta, ...metadata },
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

/**
 * Sign out a user from every device. Useful after a suspicious login,
 * password rotation, or role change that needs immediate effect.
 */
export async function revokeAllSessions(user_id: string): Promise<void> {
  await requireRole(["super_admin"]);
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.auth.admin as any).signOut(user_id, "global");
  if (error) throw new Error(error.message);
}
