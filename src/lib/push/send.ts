/**
 * Server-side push sender — multi-transport.
 *
 * Routes each subscription to the right transport based on `platform`:
 *   - web   → Web Push (VAPID, via the `web-push` package)
 *   - ios   → FCM HTTP API (which forwards to APNS internally)
 *   - android → FCM HTTP API
 *
 * Supabase stays the source of truth. The `push_subscriptions` table holds
 * one row per registered device; the `platform` column added in the Phase 24
 * migration tells us which transport to use. FCM is the delivery channel for
 * native rows only — all data, auth, and realtime remain on Supabase.
 *
 * Required env vars by transport:
 *   Web Push:
 *     VAPID_PUBLIC_KEY         (also expose as NEXT_PUBLIC_VAPID_PUBLIC_KEY)
 *     VAPID_PRIVATE_KEY
 *     VAPID_SUBJECT            (e.g. "mailto:admin@yourdomain.com")
 *   Native (FCM):
 *     FCM_SERVER_KEY           (Firebase Console → Cloud Messaging → Server key)
 *
 * Any missing env var fails the corresponding transport gracefully (logs
 * once, returns). The OTHER transports keep working. So if VAPID is unset,
 * native still sends; if FCM_SERVER_KEY is unset, web still sends.
 *
 * To activate full stack:
 *   1. `npm i web-push @types/web-push`  (already in deps)
 *   2. `npx web-push generate-vapid-keys` → set the three VAPID_* env vars
 *   3. Firebase Console → enable Cloud Messaging → copy Server key → set FCM_SERVER_KEY
 *   4. `supabase db push` for the Phase 24 push_subscriptions migration
 *   5. Residents tap "Enable push notifications" in /m/notifications (web) or
 *      grant permission on first app open (native — handled by
 *      <NativePushRegister />).
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { sendNativePush } from "@/lib/push/send-native";

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

interface SubRow {
  id:       string;
  endpoint: string;
  p256dh:   string | null;
  auth:     string | null;
  /** `platform` column added in migration 20260521000000. Defaults to "web"
   * for rows created before the migration. */
  platform: "web" | "ios" | "android" | null;
}

function vapidConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

let vapidWarned = false;
let webpushMissingWarned = false;

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subs, error } = await (admin as any)
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, platform")
    .eq("user_id", userId);
  if (error) {
    logger.error("push", "subscriptions query failed", error);
    return;
  }

  // Tolerate older schemas (pre Phase 24 migration) where `platform` doesn't
  // exist — Supabase returns the column as undefined; coerce to "web".
  // Cast goes through `unknown` because the generated Supabase types haven't
  // been regenerated with `platform` yet (npm run db:types pending).
  const all: SubRow[] = (((subs ?? []) as unknown) as SubRow[]).map((s) => ({
    ...s,
    platform: s.platform ?? "web",
  }));
  if (all.length === 0) return;

  // Split by transport.
  const webSubs    = all.filter((s) => s.platform === "web");
  const nativeSubs = all.filter((s) => s.platform === "ios" || s.platform === "android");

  // Web Push branch (existing behaviour).
  if (webSubs.length > 0) {
    await sendWebBatch(admin, webSubs, payload);
  }

  // Native branch (Phase 7 — FCM HTTP API).
  if (nativeSubs.length > 0) {
    await sendNativeBatch(admin, nativeSubs, payload);
  }
}

/* -------------------------------------------------------------------- */
/* Web Push                                                              */
/* -------------------------------------------------------------------- */

async function sendWebBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  subs: SubRow[],
  payload: PushPayload,
): Promise<void> {
  if (!vapidConfigured()) {
    if (!vapidWarned) {
      logger.info("push", "web push skipped — VAPID env vars not set");
      vapidWarned = true;
    }
    return;
  }

  // Dynamic import — fails gracefully if the package isn't installed.
  let webpush: typeof import("web-push") | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webpush = (await import("web-push" as any)).default ?? (await import("web-push" as any));
  } catch {
    if (!webpushMissingWarned) {
      logger.info("push", "web push skipped — `web-push` package not installed");
      webpushMissingWarned = true;
    }
    return;
  }
  if (!webpush) return;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const body = JSON.stringify({
    title: payload.title,
    body:  payload.body ?? "",
    data:  { url: payload.url ?? "/m" },
    tag:   payload.tag ?? "srp",
  });

  for (const s of subs) {
    if (!s.p256dh || !s.auth) {
      // Defensive — a "web" row without keys is malformed. Skip it.
      continue;
    }
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
      );
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = e as any;
      const status = err?.statusCode ?? err?.status ?? 0;
      logger.error("push", `web send failed (status ${status})`, e);
      // 410 = subscription gone — prune it.
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", s.id);
      }
    }
  }
}

/* -------------------------------------------------------------------- */
/* Native (FCM)                                                          */
/* -------------------------------------------------------------------- */

async function sendNativeBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  subs: SubRow[],
  payload: PushPayload,
): Promise<void> {
  // Iterate one-by-one so a dead token doesn't blow up the rest. FCM has a
  // batch API but it's tied to the v1 HTTP endpoint (which we'd need
  // OAuth2 for); the legacy single-token endpoint is fine at our volume.
  for (const s of subs) {
    const platform = s.platform as "ios" | "android";
    const { gone, status } = await sendNativePush(s.endpoint, payload, platform);
    if (gone) {
      // Token is invalid/unregistered — clean it up so future sends skip.
      logger.info("push", `pruning dead native token (status ${status}) id=${s.id}`);
      await admin.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
}
