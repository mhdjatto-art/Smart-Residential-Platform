/**
 * Supabase auth callback.
 *
 * Called when a user clicks the magic link in their email (alternative path to
 * the OTP form). Exchanges the `code` query param for a session cookie and
 * redirects to the originally requested page.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  // Fall back to /login with an error param so the UI can surface it.
  const fail = new URL("/login", url.origin);
  fail.searchParams.set("error", "callback_failed");
  return NextResponse.redirect(fail);
}
