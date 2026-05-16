/**
 * Server-side Web Push sender.
 *
 * Uses the `web-push` npm package via DYNAMIC IMPORT so the project builds
 * even without it installed. If the package or VAPID keys are missing, the
 * function becomes a no-op (logs once and returns).
 *
 * To activate:
 *   1. `npm i web-push @types/web-push`
 *   2. Generate VAPID keys: `npx web-push generate-vapid-keys`
 *   3. Set env vars in Vercel:
 *        VAPID_PUBLIC_KEY        (also expose as NEXT_PUBLIC_VAPID_PUBLIC_KEY)
 *        VAPID_PRIVATE_KEY
 *        VAPID_SUBJECT           (e.g. "mailto:admin@yourdomain.com")
 *   4. Run install-push-subscriptions.sql in Supabase
 *   5. Residents tap "Enable push notifications" in /m/notifications
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

function pushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

let warned = false;

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!pushConfigured()) {
    if (!warned) {
      logger.info("push", "skipped — VAPID env vars not set");
      warned = true;
    }
    return;
  }

  // Dynamic import — fails gracefully if the package isn't installed
  let webpush: typeof import("web-push") | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webpush = (await import("web-push" as any)).default ?? (await import("web-push" as any));
  } catch {
    if (!warned) {
      logger.info("push", "skipped — `web-push` package not installed (run: npm i web-push)");
      warned = true;
    }
    return;
  }
  if (!webpush) return;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) {
    logger.error("push", "subscriptions query failed", error);
    return;
  }

  type Sub = { id: string; endpoint: string; p256dh: string; auth: string };
  const all = ((subs ?? []) as Sub[]);
  if (all.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    data: { url: payload.url ?? "/m" },
    tag: payload.tag ?? "srp",
  });

  for (const s of all) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
      );
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = e as any;
      const status = err?.statusCode ?? err?.status ?? 0;
      logger.error("push", `send failed (status ${status})`, e);
      // 410 = subscription gone — clean it up
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", s.id);
      }
    }
  }
}
