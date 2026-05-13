/**
 * Centralized error + event reporter.
 *
 * Goal: surface production failures somewhere we'll actually look, without
 * adding a heavy SDK before we've picked one. The interface is shaped so we
 * can drop in `@sentry/nextjs` later by adding ONE call in `report()` — every
 * call site stays the same.
 *
 * Current behavior:
 *   • Always logs to console (stays visible in Vercel logs).
 *   • If `SENTRY_DSN` is set AND `@sentry/nextjs` is installed, dynamically
 *     imports it and forwards. The dynamic import means no bundle cost if
 *     Sentry isn't configured yet.
 *   • If `SLACK_OPS_WEBHOOK_URL` is set, posts a one-line summary for
 *     critical-severity events. Lightweight fallback when Sentry isn't ready.
 *
 * Usage:
 *   import { reportError } from "@/lib/observability/report";
 *   try { … } catch (e) { reportError(e, { module: "billing-run" }); }
 */

type Severity = "info" | "warning" | "error" | "critical";

interface ReportOptions {
  module?: string;
  userId?: string;
  orgId?: string;
  severity?: Severity;
  extra?: Record<string, unknown>;
}

let sentryAttempted = false;
type SentryShape = {
  captureException?: (e: unknown, ctx?: { tags?: Record<string, string>; extra?: Record<string, unknown> }) => void;
  captureMessage?: (m: string, ctx?: { level?: string; tags?: Record<string, string>; extra?: Record<string, unknown> }) => void;
};
let sentryRef: SentryShape | null = null;

async function tryGetSentry(): Promise<SentryShape | null> {
  if (sentryRef) return sentryRef;
  if (sentryAttempted) return null;
  sentryAttempted = true;
  if (!process.env.SENTRY_DSN) return null;
  try {
    // Optional — only loads if the dep is actually installed
    const mod = await import("@sentry/nextjs" as string).catch(() => null);
    if (mod && typeof mod === "object") sentryRef = mod as unknown as SentryShape;
    return sentryRef;
  } catch {
    return null;
  }
}

async function postSlack(summary: string, opts: ReportOptions) {
  const url = process.env.SLACK_OPS_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `🚨 *SRP ${opts.severity ?? "error"}* in ${opts.module ?? "unknown"}\n\`\`\`${summary.slice(0, 1500)}\`\`\``,
      }),
    });
  } catch {
    /* swallow — never let observability errors break the request */
  }
}

export function reportError(err: unknown, opts: ReportOptions = {}): void {
  const severity = opts.severity ?? "error";
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
  const stack = err instanceof Error ? err.stack : undefined;
  const tag = opts.module ? `[${opts.module}] ` : "";

  // Always console — these go to Vercel logs.
  console.error(`${tag}${severity.toUpperCase()}: ${msg}`, stack ? "\n" + stack : "");

  // Fire-and-forget the optional sinks
  void (async () => {
    const sentry = await tryGetSentry();
    if (sentry?.captureException) {
      sentry.captureException(err, {
        tags: { module: opts.module ?? "unknown", severity },
        extra: { userId: opts.userId, orgId: opts.orgId, ...opts.extra },
      });
    }
    if (severity === "critical") {
      await postSlack(`${tag}${msg}`, opts);
    }
  })();
}

export function reportEvent(message: string, opts: ReportOptions = {}): void {
  const severity = opts.severity ?? "info";
  const tag = opts.module ? `[${opts.module}] ` : "";
  console.log(`${tag}${severity}: ${message}`);

  void (async () => {
    const sentry = await tryGetSentry();
    if (sentry?.captureMessage) {
      sentry.captureMessage(message, {
        level: severity === "warning" ? "warning" : severity === "error" || severity === "critical" ? "error" : "info",
        tags: { module: opts.module ?? "unknown", severity },
        extra: { userId: opts.userId, orgId: opts.orgId, ...opts.extra },
      });
    }
    if (severity === "critical") {
      await postSlack(`${tag}${message}`, opts);
    }
  })();
}
