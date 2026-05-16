/**
 * GET /api/cron/billing-run
 * ─────────────────────────
 * Daily auto-billing endpoint, triggered by Vercel Cron.
 *
 * Authentication: fail-closed via requireCronAuth() — in production, if
 * CRON_SECRET is unset OR the Authorization header doesn't match, we 401/503.
 * In dev with the env unset, calls are allowed for local testing.
 *
 * Uses the service-role client so it does NOT need a user session.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronAuth } from "@/lib/cron/auth";
import { reportError } from "@/lib/observability/report";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireCronAuth(request, "billing-run");
  if (denied) return denied;

  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any).rpc("generate_due_utility_bills", { p_dry_run: false });
    if (error) {
      reportError(new Error(error.message), { module: "cron/billing-run", severity: "critical" });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    logger.info("cron/billing-run", "summary", data);
    return NextResponse.json({ ok: true, summary: data });
  } catch (err) {
    reportError(err, { module: "cron/billing-run", severity: "critical" });
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
