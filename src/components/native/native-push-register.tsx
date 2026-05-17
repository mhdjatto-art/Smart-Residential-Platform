"use client";

/**
 * Native push registration.
 *
 * Runs ONLY inside the Capacitor native shell (iOS/Android). On the web build
 * this is a no-op — web push subscriptions go through `<SwRegister />` /
 * `/api/push/subscribe` instead, and the two flows share the same
 * `push_subscriptions` table on the server.
 *
 * Flow:
 *   1. Mount → check `isNative()`. Bail on the web build.
 *   2. Request notification permissions (iOS shows a system prompt the first
 *      time; Android 13+ shows it too).
 *   3. Register with APNS/FCM. The plugin fires `registration` with a token.
 *   4. POST the token to `/api/push/register`. The endpoint upserts on
 *      `(user_id, endpoint)` so subsequent registrations are idempotent.
 *
 * A ref guards against the rare double-invoke that React StrictMode triggers
 * in development. We deliberately don't retry on transient failures here —
 * users open the app frequently, and a failed registration heals on the next
 * launch with zero user-visible impact.
 *
 * IMPORTANT: This component renders nothing. Mount it once at the top of
 * `/m/layout.tsx` after auth has been verified.
 */
import { useEffect, useRef } from "react";
import { isNative, getPlatform } from "@/lib/native/capacitor-bridge";

export function NativePushRegister(): null {
  // StrictMode double-mount guard. Without this, two parallel
  // requestPermissions() calls fire on dev — harmless but noisy.
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    // Web/desktop build → nothing to do.
    if (!isNative()) return;

    void registerNativePush();
  }, []);

  return null;
}

/**
 * Internal: do the actual registration. Kept outside the component so the
 * effect body stays small. All errors are swallowed and logged — push is a
 * best-effort capability, never block app boot on it.
 */
async function registerNativePush(): Promise<void> {
  try {
    // Dynamic import so the web bundle never pulls in the native plugin.
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      // User denied. We respect the decision and don't re-prompt on every
      // app open — the OS handles that.
      console.info("[native-push] permission not granted:", perm.receive);
      return;
    }

    // Register listeners BEFORE calling register(), because on some platforms
    // the `registration` event fires synchronously inside register().
    PushNotifications.addListener("registration", (token) => {
      void postTokenToServer(token.value).catch((err) => {
        console.warn("[native-push] POST /api/push/register failed:", err);
      });
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.warn("[native-push] registration error:", err);
    });

    await PushNotifications.register();
  } catch (e) {
    // The most common reason for this catch is that the plugin failed to
    // load (e.g. running in a web preview that mistakenly identifies as
    // native). Safe to ignore.
    console.warn("[native-push] init failed:", e);
  }
}

/**
 * POST the token to our backend. The endpoint is idempotent on
 * (user_id, endpoint) so repeat calls are safe — newer launches just bump
 * `updated_at`. Cookies are forwarded so the server can identify the user.
 */
async function postTokenToServer(token: string): Promise<void> {
  const platform = getPlatform(); // "ios" | "android" | "web"
  if (platform === "web") return; // defensive: shouldn't happen here

  const res = await fetch("/api/push/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token, platform }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}
