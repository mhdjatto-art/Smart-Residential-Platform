"use client";

/**
 * "Enable push notifications" button.
 *
 * Asks for browser permission, subscribes to the Push API using the public
 * VAPID key, and POSTs the subscription to /api/push/subscribe so the server
 * can send to it later.
 *
 * Falls back gracefully when:
 *   • The browser doesn't support Push API (iOS Safari < 16.4)
 *   • The VAPID public key is not configured in env
 *   • The user denies permission
 */

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

// Web Push expects the VAPID public key as a Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushSubscribeButton() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);

    // Check if we're already subscribed
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    }).catch(() => { /* SW not ready yet */ });
  }, []);

  function subscribe() {
    if (!VAPID_PUBLIC) {
      toast.error("Push not configured", { description: "Server admin: set NEXT_PUBLIC_VAPID_PUBLIC_KEY" });
      return;
    }
    startTransition(async () => {
      try {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== "granted") {
          toast.error("Permission denied", { description: "Enable notifications in your browser settings." });
          return;
        }

        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
        });

        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            p256dh: arrayBufferToBase64(sub.getKey("p256dh")),
            auth:   arrayBufferToBase64(sub.getKey("auth")),
            user_agent: navigator.userAgent,
          }),
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        setSubscribed(true);
        toast.success("Push notifications enabled");
      } catch (err) {
        toast.error("Subscribe failed", { description: err instanceof Error ? err.message : "Unknown error" });
      }
    });
  }

  function unsubscribe() {
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) { setSubscribed(false); return; }
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
        setSubscribed(false);
        toast.success("Push notifications disabled");
      } catch (err) {
        toast.error("Unsubscribe failed", { description: err instanceof Error ? err.message : "Unknown error" });
      }
    });
  }

  if (!supported) {
    return (
      <Button variant="outline" size="sm" disabled>
        <BellOff className="h-4 w-4" /> Push not supported
      </Button>
    );
  }
  if (permission === "denied") {
    return (
      <Button variant="outline" size="sm" disabled>
        <BellOff className="h-4 w-4" /> Notifications blocked
      </Button>
    );
  }

  if (subscribed) {
    return (
      <Button variant="outline" size="sm" onClick={unsubscribe} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
        Disable push
      </Button>
    );
  }
  return (
    <Button size="sm" onClick={subscribe} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
      Enable push notifications
    </Button>
  );
}

function arrayBufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
