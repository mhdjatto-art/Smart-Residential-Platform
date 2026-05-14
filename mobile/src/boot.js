/**
 * Boot script for the native shell.
 *
 * Responsibilities:
 *   1. Detect network status. If offline → show offline screen.
 *   2. If online → hand off to the live web app at `${ORG_SERVER_URL}/m`.
 *   3. Register native push token with our server on first launch.
 *
 * This file is intentionally dependency-free (no npm imports) so the
 * shell stays under 50KB and boots instantly.
 *
 * Capacitor exposes plugins on `window.Capacitor.Plugins.*` at runtime.
 */

const ORG_SERVER_URL = window.__ORG_SERVER_URL__ ?? "https://smart-residential-platform.vercel.app/m";

(async function boot() {
  const splash  = document.getElementById("splash");
  const offline = document.getElementById("offline");

  // 1. Check connectivity via Capacitor Network plugin if available.
  let online = navigator.onLine;
  if (window.Capacitor?.Plugins?.Network) {
    try {
      const status = await window.Capacitor.Plugins.Network.getStatus();
      online = status.connected;
    } catch { /* fallback to navigator.onLine */ }
  }

  if (!online) {
    splash.classList.add("hide");
    offline.classList.add("show");
    return;
  }

  // 2. Register native push notification token (best-effort).
  await registerPushTokenIfNeeded().catch(() => { /* swallow */ });

  // 3. Hand off to the live web app.
  // Tiny delay so the splash is visible long enough to feel intentional.
  setTimeout(() => {
    window.location.replace(ORG_SERVER_URL);
  }, 600);
})();

/**
 * Register the device's APNS (iOS) / FCM (Android) push token with our backend.
 * On the server side this row goes into `push_subscriptions` so any
 * `sendPush()` call can fan out to native devices in addition to web.
 */
async function registerPushTokenIfNeeded() {
  const Push = window.Capacitor?.Plugins?.PushNotifications;
  if (!Push) return;

  // Request permission. iOS shows a system prompt on first call.
  const perm = await Push.requestPermissions();
  if (perm.receive !== "granted") return;

  // Register listener BEFORE registering — `register()` triggers the
  // `registration` event synchronously on some platforms.
  await new Promise((resolve) => {
    Push.addListener("registration", async (token) => {
      try {
        // Post the token to our backend. The endpoint is idempotent on
        // `(user_id, token)` so re-registration is safe.
        await fetch(`${ORG_SERVER_URL}/../api/push/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            token: token.value,
            platform: window.Capacitor.getPlatform(),
          }),
        });
      } catch (e) {
        console.warn("[shell] push register failed", e);
      }
      resolve();
    });
    Push.addListener("registrationError", (err) => {
      console.warn("[shell] push registration error", err);
      resolve();
    });
    Push.register();
  });
}
