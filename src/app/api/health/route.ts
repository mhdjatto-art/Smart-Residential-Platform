/**
 * Liveness probe. Useful for Vercel health checks and uptime monitors.
 * Intentionally does NOT hit the database — that's a separate readiness probe
 * we can add later.
 */

import { NextResponse } from "next/server";

export const runtime = "edge";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "srp",
    timestamp: new Date().toISOString(),
  });
}
