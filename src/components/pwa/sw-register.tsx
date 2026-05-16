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

    let focusHandler: (() => void) | null = null;
    let registration: ServiceWorkerRegistration | null = null;

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        // Re-check for updates whenever the tab regains focus.
        focusHandler = () => {
          registration?.update().catch((err) => {
            // eslint-disable-next-line no-console
            console.warn("[sw-register] update check failed:", err);
          });
        };
        window.addEventListener("focus", focusHandler);
      } catch (err) {
        // Service-worker registration is best-effort. Log but don't throw.
        // eslint-disable-next-line no-console
        console.warn("[sw-register] registration failed:", err);
      }
    };

    register().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[sw-register] register() rejected:", err);
    });

    return () => {
      if (focusHandler) window.removeEventListener("focus", focusHandler);
    };
  }, []);

  return null;
}
