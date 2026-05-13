/**
 * POST /api/push/subscribe   — save a Push API subscription for the current user
 * DELETE /api/push/subscribe — remove one by endpoint
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthenticated" }, { status: 401 }); }

  const body = await req.json().catch(() => null) as {
    endpoint?: string; p256dh?: string; auth?: string; user_agent?: string;
  } | null;
  if (!body?.endpoint || !body.p256dh || !body.auth) {
    return NextResponse.json({ error: "Missing endpoint/p256dh/auth" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: body.endpoint,
        p256dh: body.p256dh,
        auth: body.auth,
        user_agent: body.user_agent ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthenticated" }, { status: 401 }); }

  const body = await req.json().catch(() => null) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", body.endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
