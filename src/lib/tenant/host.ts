import "server-only";
import { headers } from "next/headers";

/**
 * Read the tenant the middleware resolved for the current request. Returns
 * null if the request came in on a platform host (no custom-domain mapping)
 * or before the middleware ran.
 */
export async function getResolvedTenantId(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-srp-tenant-id") ?? null;
  } catch {
    return null;
  }
}

export async function getRequestHost(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-srp-host") ?? h.get("host") ?? null;
  } catch {
    return null;
  }
}
