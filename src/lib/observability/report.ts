/**
 * Centralized error + event reporter.
 *
 * Behavior:
 *   • Always logs to console (visible in Vercel function logs).
 *   • If `SENTRY_DSN` is set, forwards to Sentry (initialized in
 *     sentry.{server,client,edge}.config.ts via instrumentation.ts).
 *   • If `SLACK_OPS_WEBHOOK_URL` is set, posts a one-line summary for
 *     critical-severity events.
 *
 * Usage:
 *   import { reportError, reportEvent } from "@/lib/observability/report";
 *   try { … } catch (e) { reportError(e, { module: "billing-run" }); }
 */
import * as Sentry from "@sentry/nextjs";

type Severity = "info" | "warning" | "error" | "critical";

interface ReportOptions {
  module?: string;
  userId?: string;
  orgId?: string;
  severity?: Severity;
  extra?: Record<string, unknown>;
}

function sentryEnabled(): boolean {
  return !!(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN);
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

  // Sentry (if configured)
  if (sentryEnabled()) {
    Sentry.captureException(err, {
      tags: { module: opts.module ?? "unknown", severity },
      user: opts.userId ? { id: opts.userId } : undefined,
      extra: { orgId: opts.orgId, ...opts.extra },
    });
  }

  // Slack (critical only — fire-and-forget)
  if (severity === "critical") {
    void postSlack(`${tag}${msg}`, opts);
  }
}

export function reportEvent(message: string, opts: ReportOptions = {}): void {
  const severity = opts.severity ?? "info";
  const tag = opts.module ? `[${opts.module}] ` : "";
  console.log(`${tag}${severity}: ${message}`);

  if (sentryEnabled()) {
    Sentry.captureMessage(message, {
      level:
        severity === "warning" ? "warning" :
        severity === "error" || severity === "critical" ? "error" :
        "info",
      tags: { module: opts.module ?? "unknown", severity },
      user: opts.userId ? { id: opts.userId } : undefined,
      extra: { orgId: opts.orgId, ...opts.extra },
    });
  }

  if (severity === "critical") {
    void postSlack(`${tag}${message}`, opts);
  }
}
