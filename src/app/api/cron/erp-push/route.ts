/**
 * GET /api/cron/erp-push
 * ─────────────────────
 * Picks queued journal_entries and pushes them to the configured ERP.
 * Auth via CRON_SECRET. Schedule in vercel.json:
 *   { "path": "/api/cron/erp-push", "schedule": "*\/15 * * * *" }   # every 15 min
 */

import { NextResponse } from "next/server";
import { pushQueuedJournalEntries } from "@/lib/erp/worker";
import { requireCronAuth } from "@/lib/cron/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const denied = requireCronAuth(request, "erp-push");
  if (denied) return denied;

  try {
    const summary = await pushQueuedJournalEntries();
    console.log("[erp-push] summary:", JSON.stringify(summary, null, 0));
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error("[erp-push] threw:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
