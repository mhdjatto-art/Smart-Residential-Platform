/**
 * Service-role Supabase client.
 *
 * Bypasses RLS. Use only for privileged operations that must work regardless
 * of the caller's identity:
 *   - Inviting / provisioning new users
 *   - Bootstrapping the first super_admin via a script
 *   - Bulk imports
 *
 * NEVER import this from a Client Component. The `server-only` import at the
 * top crashes the build if anyone tries.
 */

import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env-server";
import type { Database } from "@/types/database";

export function createAdminClient() {
  const env = getServerEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
