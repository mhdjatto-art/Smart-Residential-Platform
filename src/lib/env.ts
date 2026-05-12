/**
 * Type-safe environment access.
 *
 * We validate at module load and crash loudly on misconfiguration rather than
 * letting a missing key surface as a confusing runtime error inside a Supabase
 * client. `serverEnv` must NEVER be imported from a client component.
 */

import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
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

/** Safe to import in client components. */
export const publicEnv = parseEnv(publicSchema, {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

/**
 * SERVER ONLY. Importing this from a client component will leak the service
 * role key. The "server-only" import below makes Next.js bail the build if
 * someone tries.
 */
export function getServerEnv() {
  // Lazy import so client bundlers don't try to resolve "server-only".
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("server-only");
  return parseEnv(serverSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
