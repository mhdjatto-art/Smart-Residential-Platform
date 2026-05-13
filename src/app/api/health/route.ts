/**
 * Health probe.
 *
 *  - GET /api/health           — full readiness check (DB ping). 503 on failure.
 *  - GET /api/health?mode=live — liveness only. Returns 200 if the route runs.
 *
 * Uptime monitors (UptimeRobot, BetterStack, Pingdom) and Vercel's status
 * check should hit the readiness check so they actually catch a DB outage.
 *
 * The DB ping is intentionally cheap: a count on `organizations` with limit 0
 * — no rows transferred, just confirms the connection + RLS path resolves.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 1500;

async function pingDb(): Promise<{ ok: true; latency_ms: number } | { ok: false; error: string }> {
  const started = Date.now();
  try {
    const admin = createAdminClient();
    const result = await Promise.race([
      admin.from("organizations").select("id", { count: "exact", head: true }).limit(1),
      new Promise<{ error: { message: string } }>((_, reject) =>
        setTimeout(() => reject(new Error(`DB ping timed out after ${DB_TIMEOUT_MS}ms`)), DB_TIMEOUT_MS),
      ),
    ]);
    const latency = Date.now() - started;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = (result as any)?.error;
    if (err) return { ok: false, error: err.message };
    return { ok: true, latency_ms: latency };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");

  if (mode === "live") {
    return NextResponse.json({
      status: "ok",
      service: "srp",
      mode: "live",
      timestamp: new Date().toISOString(),
    });
  }

  const db = await pingDb();
  if (!db.ok) {
    return NextResponse.json(
      {
        status: "unhealthy",
        service: "srp",
        mode: "ready",
        db: { ok: false, error: db.error },
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    status: "ok",
    service: "srp",
    mode: "ready",
    db: { ok: true, latency_ms: db.latency_ms },
    timestamp: new Date().toISOString(),
  });
}
