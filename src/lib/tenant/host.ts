import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const PLATFORM_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "smart-residential-platform.vercel.app",
  "srp.app",
  "www.srp.app",
]);

/**
 * Read the request `Host` header stamped by middleware. Falls back to
 * whatever `headers()` reports if the stamp is missing.
 */
export async function getRequestHost(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-srp-host") ?? h.get("host") ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve the tenant the current request belongs to by looking up the host
 * in `organization_domains`. Cached per request via Next.js automatic
 * dedupe — call it freely from Server Components.
 *
 * Returns null on a platform-owned host (no custom-domain mapping), or
 * if anything fails. NEVER throws.
 */
export async function getResolvedTenantId(): Promise<string | null> {
  try {
    const host = await getRequestHost();
    if (!host) return null;
    const normalized = host.split(":")[0]!.toLowerCase();
    if (PLATFORM_HOSTS.has(normalized)) return null;

    const supabase = await createClient();
    const { data } = await supabase
      .from("organization_domains")
      .select("organization_id")
      .eq("host", normalized)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any)?.organization_id ?? null;
  } catch {
    return null;
  }
}
