/* SRP Service Worker — Phase 7 PWA infrastructure
 *
 * Strategy
 * ─────────
 * 1. Precache the offline shell + manifest.
 * 2. Network-first for `/api`, server actions, and `/_next/data` (so we never
 *    serve stale tenant data to the wrong user).
 * 3. Stale-while-revalidate for static `/icons/*` and the offline shell.
 * 4. Cache bust on every deploy by bumping CACHE_VERSION (string below).
 *
 * NOTE: Authenticated screens (`/m/*` etc.) MUST always hit the network so
 * Supabase RLS can re-evaluate the session. We never put HTML responses for
 * those into the cache. The offline shell is only shown as a fallback.
 */

const CACHE_VERSION = "srp-v1-2026-05-12";
const PRECACHE_ASSETS = [
  "/offline",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(PRECACHE_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET — server actions, POSTs etc. always go straight to network.
  if (req.method !== "GET") return;
  if (!url.origin.startsWith(self.location.origin)) return;

  // Never cache authenticated/dynamic Next.js endpoints.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/auth/")
  ) return; // default network behaviour

  // For the install shell + static icons, stale-while-revalidate.
  if (PRECACHE_ASSETS.some((p) => url.pathname === p) || url.pathname.startsWith("/icons/")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(req);
      const fetched = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached ?? fetched;
    })());
    return;
  }

  // For mobile shell HTML — try network first, fall back to offline shell.
  const isMobileNav = req.mode === "navigate" && url.pathname.startsWith("/m");
  if (isMobileNav) {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        const cache = await caches.open(CACHE_VERSION);
        return (await cache.match("/offline")) ?? Response.error();
      }
    })());
  }
});

// Push notification placeholder — wired in Module 3.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { title: "SRP", body: event.data.text() }; }
  const title = payload.title || "SRP";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.svg",
    badge: "/icons/icon-192.svg",
    data: payload.data || {},
    tag: payload.tag || "srp-notification",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/m";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of all) {
      if (client.url.endsWith(target) && "focus" in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
