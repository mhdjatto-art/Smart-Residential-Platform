/**
 * Sentry — browser-side configuration.
 *
 * Loaded automatically by `@sentry/nextjs` on every page load. Without
 * `NEXT_PUBLIC_SENTRY_DSN` we initialize at zero cost and capture nothing,
 * so it's safe to ship even before the DSN is wired up.
 *
 * Required env var:
 *   NEXT_PUBLIC_SENTRY_DSN  — DSN from https://sentry.io/settings/.../projects/.../keys/
 *
 * Optional:
 *   NEXT_PUBLIC_SENTRY_ENVIRONMENT  — 'production' | 'preview' | 'development'
 *                                     (defaults to NODE_ENV)
 *   NEXT_PUBLIC_SENTRY_TRACES_RATE  — 0..1, request transactions to sample
 */
import * as Sentry from "@sentry/nextjs";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_RATE ?? 0.1),
    // Session replays are useful for UX bugs but cost more — keep low.
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 0.1,
    // Reduce noise from harmless browser quirks.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications.",
      "Network request failed",
      // Add app-specific noise as you spot it
    ],
  });
}
