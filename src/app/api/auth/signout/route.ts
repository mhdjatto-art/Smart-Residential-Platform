/**
 * Sign-out endpoint.
 *
 *   POST /api/auth/signout
 *
 * The primary logout flow is client-side `supabase.auth.signOut()` from the
 * topbar — it's a single round-trip and clears local state immediately.
 *
 * This endpoint exists for:
 *   • External tooling / scripts that want to invalidate a session.
 *   • SSR/non-JS environments where calling the client SDK isn't possible.
 *   • Tests that need a deterministic logout without driving the browser.
 *
 * Accepts both POST (preferred — non-idempotent state change) and GET (for
 * environments where POST is awkward). Always returns 200 even when there's
 * no active session, so it's safe to call defensively.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function signOut(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (e) {
    // Don't surface auth errors to the caller — the cookie was either
    // already invalid or we just nuked it. Either way the session is gone.
    logger.info("auth-signout", "ignored error during signOut", e);
  }
  return NextResponse.json({ ok: true });
}

export async function POST(): Promise<NextResponse> {
  return signOut();
}

export async function GET(): Promise<NextResponse> {
  return signOut();
}
