/**
 * Sentry — Node.js server-side configuration.
 *
 * Loaded for every server-rendered request, API route, and server action.
 * Without `SENTRY_DSN` we initialize at zero cost.
 *
 * Required env var:
 *   SENTRY_DSN  — same project DSN as the client (both writes go to the
 *                 same project — Sentry tags them with `runtime: node`).
 *
 * Optional:
 *   SENTRY_ENVIRONMENT  — 'production' | 'preview' | 'development'
 *   SENTRY_TRACES_RATE  — 0..1 (lower than client; server traffic is heavier)
 */
import * as Sentry from "@sentry/nextjs";

const DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_RATE ?? 0.05),
    // Don't send default PII (IPs, request bodies) — we set extras manually.
    sendDefaultPii: false,
    // Drop known-noise events
    ignoreErrors: [
      "AbortError",
      "ECONNRESET",
      // Add app-specific noise as you spot it
    ],
  });
}
