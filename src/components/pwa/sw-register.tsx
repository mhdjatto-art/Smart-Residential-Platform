"use client";

/**
 * Registers the SRP service worker (public/sw.js). Mounted in the root layout.
 *
 * Production-only — never registers in development to avoid stale caches
 * during HMR. Listens for the `controllerchange` event so we can prompt the
 * user when a new version of the app shell is ready.
 */

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        // Re-check for updates whenever the tab regains focus.
        window.addEventListener("focus", () => reg.update().catch(() => {}));
      } catch {
        // Service-worker registration is best-effort. Silent failure is fine.
      }
    };

    register();
  }, []);

  return null;
}
