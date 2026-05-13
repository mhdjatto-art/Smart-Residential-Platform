/**
 * POST /api/meters/:id/sync
 * ─────────────────────────
 * Manual "Sync now" trigger from the meter detail page. Only management
 * roles can call it. Returns the per-meter sync detail JSON.
 */

import { NextResponse } from "next/server";
import { requireUser, AuthorizationError } from "@/lib/auth/guards";
import { syncSingleMeter } from "@/lib/meter-adapters/worker";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(req, "meter-sync-manual", 20, 60_000);
  if (limited) return limited;

  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // Anyone in the org with a management role can trigger a sync.
  if (!user.isSuperAdmin && !user.roles.some(r =>
    ["super_admin","developer_admin","compound_manager","maintenance_staff","finance_officer"].includes(r.role))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing meter id" }, { status: 400 });

  try {
    const detail = await syncSingleMeter(id);
    return NextResponse.json({ ok: detail.outcome === "succeeded", detail });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
  }
}
