import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Root entry. We redirect to /dashboard if logged in, /login otherwise.
 * Keeping this as a server component means there's no client flash.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/dashboard" : "/login");
}
