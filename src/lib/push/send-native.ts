/**
 * Native push sender — FCM (Android) and APNS-via-FCM (iOS).
 *
 * We deliberately don't link the Firebase Admin SDK on the server. Instead we
 * hit FCM's HTTP endpoint with `Authorization: key=<FCM_SERVER_KEY>`. This
 * keeps the deployment dependency surface tiny: no service-account JSON, no
 * heavy node_modules, no Firebase Admin types.
 *
 * Supabase remains the source of truth — `push_subscriptions` holds every
 * token, and we route each row to the correct transport at send time. FCM is
 * used ONLY as the delivery channel for native devices; data, auth, and
 * realtime stay on Supabase.
 *
 * Note on the API surface used:
 *   This module targets the FCM "legacy" HTTP API at
 *   https://fcm.googleapis.com/fcm/send — single endpoint, single header,
 *   server key auth. Google has marked it deprecated in favour of the v1
 *   HTTP API (which needs OAuth2 + a service-account JSON), but the legacy
 *   endpoint is still live as of Q1 2025. When migration becomes urgent,
 *   swap `postFcm()` to call `https://fcm.googleapis.com/v1/projects/<id>/messages:send`
 *   with a Bearer token minted from a service-account JSON.
 *
 * Required env var:
 *   FCM_SERVER_KEY   — From Firebase Console → Project Settings → Cloud
 *                      Messaging → "Server key". Treat as a secret.
 *
 * The function fails closed: if FCM_SERVER_KEY is unset, we log once and
 * return without throwing. Callers don't need to wrap us in try/catch — push
 * is a best-effort delivery channel.
 */

import "server-only";
import { logger } from "@/lib/logger";

export interface NativePushPayload {
  title:  string;
  body?:  string;
  /** Deep-link / route to open when user taps the notification. */
  url?:   string;
  /** Notification tag — collapses identical notifications on Android. */
  tag?:   string;
}

const FCM_ENDPOINT = "https://fcm.googleapis.com/fcm/send";

let warnedMissing = false;

function fcmConfigured(): boolean {
  return !!process.env.FCM_SERVER_KEY;
}

/**
 * Send a native push to a single FCM/APNS token.
 *
 * Returns `{ ok, status, gone }` so the caller can prune dead subscriptions
 * (status 404 → token invalid, or NotRegistered/InvalidRegistration in
 * the body → also dead).
 */
export async function sendNativePush(
  token:    string,
  payload:  NativePushPayload,
  platform: "ios" | "android",
): Promise<{ ok: boolean; status: number; gone: boolean }> {
  if (!fcmConfigured()) {
    if (!warnedMissing) {
      logger.info("push-native", "skipped — FCM_SERVER_KEY not set");
      warnedMissing = true;
    }
    return { ok: false, status: 0, gone: false };
  }

  // FCM payload shape. The `notification` block is what the OS displays
  // when the app is backgrounded; the `data` block is what arrives in the
  // app's `pushNotificationReceived` listener when the app is in the
  // foreground. We send both so foreground + background both work.
  const body: Record<string, unknown> = {
    to: token,
    priority: "high",
    notification: {
      title: payload.title,
      body:  payload.body ?? "",
      sound: "default",
      tag:   payload.tag ?? "srp",
      // Open the deep link when the user taps the notification.
      click_action: payload.url ?? "/m",
    },
    data: {
      url: payload.url ?? "/m",
      tag: payload.tag ?? "srp",
    },
  };

  // iOS-specific tuning so the alert shows even when app is killed.
  if (platform === "ios") {
    body.content_available = true;
    body.mutable_content   = true;
  }

  let res: Response;
  try {
    res = await fetch(FCM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${process.env.FCM_SERVER_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    logger.error("push-native", "fetch to FCM failed", e);
    return { ok: false, status: 0, gone: false };
  }

  // FCM legacy API quirks: even on HTTP 200, individual tokens may have
  // failed (NotRegistered, InvalidRegistration). Inspect the body.
  let gone = false;
  try {
    const j = (await res.json()) as {
      failure?: number;
      results?: Array<{ error?: string }>;
    };
    if (j.results?.[0]?.error) {
      const errCode = j.results[0].error;
      gone = errCode === "NotRegistered" || errCode === "InvalidRegistration";
      if (!gone) {
        logger.error("push-native", `FCM error: ${errCode}`);
      }
    }
  } catch {
    // Body wasn't JSON; status code alone tells us if we succeeded.
  }

  // HTTP 404 from FCM means the token is dead too.
  if (res.status === 404) gone = true;

  return { ok: res.ok && !gone, status: res.status, gone };
}
