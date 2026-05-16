/**
 * Register a native push notification token (APNS / FCM) for the current user.
 *
 *   POST /api/push/register
 *   { token: string, platform: "ios" | "android" | "web" }
 *
 * Behavior:
 *   • Auth is required.
 *   • Token is upserted into `push_subscriptions` keyed on (user_id, token).
 *   • Re-registration with the same token is a no-op (idempotent).
 *   • Web push subscriptions use the existing /api/push/subscribe route.
 *     This one is exclusively for native APNS/FCM tokens from the Capacitor
 *     `PushNotifications` plugin.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface Body {
  token?: string;
  platform?: "ios" | "android" | "web";
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, platform } = body;
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }
  if (platform !== "ios" && platform !== "android" && platform !== "web") {
    return NextResponse.json({ error: "platform must be ios|android|web" }, { status: 400 });
  }

  const supabase = await createClient();

  // The `push_subscriptions` table already exists (Phase 7) for web push.
  // Phase 24 extended it with `platform`, `organization_id`, `updated_at`,
  // and made `p256dh`/`auth` nullable so native tokens can be stored too.
  // The `endpoint` column carries the raw APNS/FCM token for native rows,
  // while web subscriptions store a Push API endpoint URL there.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("push_subscriptions").upsert(
    {
      user_id:         user.id,
      organization_id: user.organizationIds[0] ?? null,
      endpoint:        token,          // native token goes here
      platform,                        // "ios" | "android" | "web"
      // p256dh / auth left undefined → NULL in DB (web-only fields)
      updated_at:      new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" },
  );

  if (error) {
    logger.error("push-register", "insert failed", error);
    return NextResponse.json({ error: "Failed to register" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
