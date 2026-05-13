"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "srp-cookie-consent";
const VERSION = "1";

/**
 * Minimal, GDPR-compliant cookie banner.
 *
 * SRP only uses strictly-necessary cookies (auth, locale, this consent
 * record), so we don't show granular toggles. We just disclose that
 * cookies are in use and let the user dismiss.
 *
 * Stored in localStorage as `srp-cookie-consent` with the version so we
 * can re-prompt if the policy changes.
 */
export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v !== VERSION) setShow(true);
    } catch {
      // Private mode / localStorage disabled — be quiet
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, VERSION);
    } catch {
      // ignore
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-2xl rounded-xl border bg-card p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">We use only essential cookies</p>
          <p className="mt-1 text-xs text-muted-foreground">
            SRP uses a small number of cookies to keep you signed in, remember your language,
            and record this notice. We do not use advertising or third-party tracking cookies.
            {" "}
            <Link href="/cookies" className="underline">Learn more</Link>.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={dismiss}>Okay</Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/privacy">Privacy</Link>
            </Button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
