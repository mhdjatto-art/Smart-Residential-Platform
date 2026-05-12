/**
 * Browser-side Supabase client.
 *
 * Use this from Client Components ("use client"). It reads the auth session
 * from cookies that the server set, so RLS sees the same user the server saw.
 *
 * Don't import this from Server Components — use `./server.ts` there.
 */

"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (cached) return cached;
  cached = createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return cached;
}
