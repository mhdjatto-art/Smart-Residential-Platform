/**
 * Sentry — edge runtime configuration (middleware + edge route handlers).
 *
 * Edge runtime is more restrictive than Node — no FS access, smaller bundle.
 * Sentry's edge SDK is a strict subset that runs there.
 */
import * as Sentry from "@sentry/nextjs";

const DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_RATE ?? 0.05),
  });
}
