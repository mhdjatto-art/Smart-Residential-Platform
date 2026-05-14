// This file configures the initialization of Sentry on the client side.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://74448a6c2c1d43a50e58f4c0e8ef4530@o4511388070576128.ingest.de.sentry.io/4511388072607824",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Session replays — useful for UX bugs but cost-aware. Keep session sampling at 0%
  // and only sample replays when an error happens.
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 0.1,

  // Reduce noise from harmless browser quirks.
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications.",
    "Network request failed",
  ],
});
