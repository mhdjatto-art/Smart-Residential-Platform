/**
 * Server-side Supabase client.
 *
 * Use from Server Components, Route Handlers, and Server Actions. Reads and
 * writes the auth cookies via Next's `cookies()` API so refreshed tokens
 * propagate correctly.
 *
 * Each call returns a fresh client to avoid leaking auth state across
 * requests in the Node runtime.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options as CookieOptions);
            }
          } catch {
            // `cookieStore.set` throws when called from a pure Server Component
            // (only Server Actions / Route Handlers can write cookies). The
            // middleware will refresh the session on the next request, so we
            // can ignore the failure here.
          }
        },
      },
    },
  );
}
