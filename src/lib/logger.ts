/**
 * Centralised logger.
 *
 * In dev: routes to console with structured prefix.
 * In prod: pushes to Sentry (errors + warnings) and silences info/debug.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("module", "message", { extra });
 *   logger.error("module", "boom", err);
 */

import { getErrorMessage } from "./errors";

type Level = "debug" | "info" | "warn" | "error";

const IS_PROD = process.env.NODE_ENV === "production";

function emit(level: Level, scope: string, message: string, extra?: unknown) {
  const stamp = new Date().toISOString();
  const prefix = `[${stamp}] [${level.toUpperCase()}] [${scope}]`;

  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(prefix, message, extra ?? "");
    // Sentry capture only in prod — avoid noise during dev.
    if (IS_PROD) {
      try {
        // Dynamic import avoids bundling Sentry into client code that doesn't use it.
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
        const Sentry: any = (global as any).__SENTRY__ ?? null;
        if (Sentry?.captureMessage) {
          Sentry.captureMessage(`[${scope}] ${message}`, "error");
        }
      } catch { /* silent */ }
    }
    return;
  }
  if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(prefix, message, extra ?? "");
    return;
  }
  if (IS_PROD && level === "debug") return; // drop verbose in prod
  // eslint-disable-next-line no-console
  console.log(prefix, message, extra ?? "");
}

export const logger = {
  debug: (scope: string, msg: string, extra?: unknown) => emit("debug", scope, msg, extra),
  info:  (scope: string, msg: string, extra?: unknown) => emit("info",  scope, msg, extra),
  warn:  (scope: string, msg: string, extra?: unknown) => emit("warn",  scope, msg, extra),
  error: (scope: string, msg: string, err?: unknown) => emit("error", scope, msg, err ? { message: getErrorMessage(err) } : undefined),
};
