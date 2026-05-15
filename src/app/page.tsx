import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginPath } from "@/lib/auth/post-login-redirect";
import type { AppRole } from "@/types";

/**
 * Root entry. Redirects to /login if unauthenticated, otherwise picks the
 * landing route based on the user's role — residents → /m, others → /dashboard.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch roles to pick the right landing route. Best-effort — fall back to /dashboard.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", user!.id);
  const roles = (Array.isArray(rows) ? rows.map((r: { role: AppRole }) => r.role) : []) as AppRole[];

  redirect(getPostLoginPath(roles));
}
