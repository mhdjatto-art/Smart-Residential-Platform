"use client";

/**
 * "Install SRP" prompt — captures the browser's beforeinstallprompt event
 * and surfaces an in-app install button so we can pick the moment ourselves.
 *
 * Only renders inside /m (mobile shell). Suppressed for 7 days after dismiss.
 */

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "srp.installPromptDismissedAt";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissedAt = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt as EventListener);
  }, []);

  function dismiss() {
    setVisible(false);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  }

  async function install() {
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice;
    dismiss();
  }

  if (!visible || !evt) return null;
  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 backdrop-blur-md shadow-lg sm:left-auto sm:right-3 sm:max-w-sm">
      <div className="flex items-start gap-3">
        <Download className="h-5 w-5 mt-0.5 text-emerald-500" />
        <div className="flex-1 text-sm">
          <p className="font-medium">Install SRP</p>
          <p className="text-muted-foreground">Add to your home screen for fast, app-like access.</p>
          <div className="mt-2 flex gap-2">
            <button onClick={install} className="rounded-md bg-emerald-500 text-white px-3 py-1 text-xs font-semibold">Install</button>
            <button onClick={dismiss} className="rounded-md border px-3 py-1 text-xs">Later</button>
          </div>
        </div>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
