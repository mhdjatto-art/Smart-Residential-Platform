/**
 * GET /api/cron/billing-run
 * ─────────────────────────
 * Daily auto-billing endpoint, triggered by Vercel Cron.
 *
 * Authentication: relies on the standard CRON_SECRET pattern. Vercel sends
 * the Authorization header `Bearer <CRON_SECRET>` if the env var is set.
 * In dev / preview, the secret check is skipped so you can hit it locally.
 *
 * Uses the service-role client so it does NOT need a user session.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any).rpc("generate_due_utility_bills", { p_dry_run: false });
    if (error) {
      console.error("[cron/billing-run] failed:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    console.log("[cron/billing-run] summary:", JSON.stringify(data));
    return NextResponse.json({ ok: true, summary: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/billing-run] threw:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
