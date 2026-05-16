/**
 * SERVER-ONLY environment access.
 *
 * Import this only from Server Components, Route Handlers, Server Actions, or
 * the admin Supabase client. The `server-only` import below makes Next.js bail
 * the build if any client component tries to import this file.
 */

import "server-only";
import { z } from "zod";
import { logger } from "@/lib/logger";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL:      z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL:           z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY:     z.string().min(1),
  STRIPE_SECRET_KEY:             z.string().optional(),
  STRIPE_WEBHOOK_SECRET:         z.string().optional(),
  SENTRY_DSN:                    z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL:           process.env.NEXT_PUBLIC_APP_URL,
    SUPABASE_SERVICE_ROLE_KEY:     process.env.SUPABASE_SERVICE_ROLE_KEY,
    STRIPE_SECRET_KEY:             process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET:         process.env.STRIPE_WEBHOOK_SECRET,
    SENTRY_DSN:                    process.env.SENTRY_DSN,
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const missing = Object.entries(flat)
      .map(([k, v]) => `  - ${k}: ${(v ?? []).join(", ")}`)
      .join("\n");
    throw new Error(`Invalid server environment configuration:\n${missing}`);
  }
  cached = parsed.data;
  return cached;
}

// Eager validation at module load — surfaces missing env vars in Vercel build
// logs rather than at first request. Skipped at edge runtime where some envs
// may be unavailable.
if (typeof process !== "undefined" && process.env.NEXT_RUNTIME !== "edge") {
  try {
    getServerEnv();
  } catch (e) {
    logger.error("env-server", "validation failed at boot", e);
    throw e;
  }
}
