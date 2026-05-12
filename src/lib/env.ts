/**
 * Public environment access — safe to import in client OR server components.
 *
 * Server-only secrets (service-role key) live in `./env-server.ts` which
 * imports the `server-only` package. Keeping them in separate files prevents
 * the bundler from accidentally pulling `server-only` into a client bundle.
 */

import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

function parseEnv<T extends z.ZodType>(schema: T, raw: Record<string, unknown>): z.infer<T> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const missing = Object.entries(flat)
      .map(([k, v]) => `  - ${k}: ${(v ?? []).join(", ")}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${missing}`);
  }
  return parsed.data;
}

/** Safe to import in client AND server components. */
export const publicEnv = parseEnv(publicSchema, {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});
