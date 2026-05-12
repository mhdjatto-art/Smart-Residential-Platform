"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-3xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;ve logged the error. Try again, and if it persists, contact support.
        </p>

        {/* Visible error details — helps the user / dev report the exact problem. */}
        <div className="mt-6 rounded-md border bg-muted/40 p-4 text-left">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Error</p>
          <p className="mt-1 break-words font-mono text-sm text-destructive">
            {error.message || "(no message)"}
          </p>
          {error.digest && (
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">
              Ref: {error.digest}
            </p>
          )}
          {error.stack && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Show stack trace
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 font-mono text-[11px] text-muted-foreground">
                {error.stack}
              </pre>
            </details>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button
            variant="outline"
            onClick={() => {
              if (typeof window !== "undefined") window.location.href = "/login";
            }}
          >
            Back to login
          </Button>
        </div>
      </div>
    </div>
  );
}
