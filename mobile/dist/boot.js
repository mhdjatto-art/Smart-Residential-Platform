/**
 * Mobile shell boot script.
 *
 * The shell is a tiny offline-safe HTML page bundled inside the Capacitor
 * APK at `mobile/dist/`. Capacitor's `server.url` (set in capacitor.config.ts)
 * means the WebView normally jumps straight to the live deployment and the
 * shell is barely seen — this file is the safety net for the rare cases
 * when `server.url` is unreachable (offline, DNS failure, dev override).
 *
 * Hybrid mode stays intact: when `server.url` works, the WebView navigates
 * away before the setTimeout below fires. When it doesn't, the setTimeout
 * kicks in and force-navigates to ORG_SERVER_URL anyway.
 *
 * The default URL below is the placeholder that scripts/build-org-app.sh
 * sed-replaces with the per-org `ORG_SERVER_URL` at build time. Keep these
 * two strings identical — see Phase 10 verification.
 */

const ORG_SERVER_URL =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  /** @type {any} */ (window).__ORG_SERVER_URL__ ??
  "https://smart-residential-platform.vercel.app/m";

console.log("[LSRP] shell boot — target:", ORG_SERVER_URL);

// If after 3 seconds we're still on the static shell (Capacitor didn't take
// over), nudge the user toward the live site. On a healthy launch this is a
// no-op because Capacitor has already navigated away.
setTimeout(() => {
  if (location.protocol === "file:" || location.pathname.endsWith("/index.html")) {
    location.replace(ORG_SERVER_URL);
  }
}, 3000);
