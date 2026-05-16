/**
 * GET /api/cron/meter-sync
 * ────────────────────────
 * Periodic meter pull. Schedule in vercel.json:
 *   { "path": "/api/cron/meter-sync", "schedule": "* /15 * * * *" }
 *
 * Fail-closed via requireCronAuth — without CRON_SECRET in production this
 * endpoint returns 503.
 */

import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron/auth";
import { runMeterSync } from "@/lib/meter-adapters/worker";
import { reportError } from "@/lib/observability/report";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const denied = requireCronAuth(request, "meter-sync");
  if (denied) return denied;

  try {
    const summary = await runMeterSync();
    logger.info("cron/meter-sync", "summary", {
      scheduled: summary.scheduled,
      succeeded: summary.succeeded,
      failed: summary.failed,
      skipped: summary.skipped,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    reportError(err, { module: "cron/meter-sync", severity: "critical" });
    const msg = err instanceof Error ? err.message : "Unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
