/**
 * POST /api/admin/seed-demo
 * ─────────────────────────
 * Super-admin–only endpoint that wipes the demo data set and reseeds a full
 * slice of the platform (one user per role + realistic business data).
 *
 * Hard-gated by `requireUser()` + super_admin check. Returns the seed
 * summary (counts + credentials) as JSON.
 */

import { NextResponse } from "next/server";
import { requireUser, AuthorizationError } from "@/lib/auth/guards";
import { runDemoSeed } from "@/lib/seed/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!user.isSuperAdmin) {
    return NextResponse.json({ error: "Only super_admin can run the demo seed." }, { status: 403 });
  }

  try {
    const summary = await runDemoSeed(user.email);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Seed failed";
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
