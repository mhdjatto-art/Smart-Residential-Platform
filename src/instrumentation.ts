/**
 * Next.js instrumentation hook.
 *
 * Required entry point for Sentry v8+ on the Node/Edge runtimes. Next.js
 * calls `register()` once at server startup, before any request is handled.
 *
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Forward errors thrown during request handling to Sentry.
// Required by @sentry/nextjs v8+.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
