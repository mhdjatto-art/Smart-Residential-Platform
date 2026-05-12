/**
 * Edge middleware — runs on every matched request before the route handler.
 *
 * Responsibilities:
 *   1. Refresh the Supabase auth session cookie (delegated to `updateSession`).
 *   2. Redirect unauthenticated users away from protected routes.
 *   3. Redirect authenticated users away from /login back to the dashboard.
 *   4. Resolve the request `Host` to a tenant organization (if a custom
 *      domain is configured) and stamp `x-srp-host` + `x-srp-tenant-id`
 *      headers on the downstream request so Server Components can read them
 *      without an extra DB hop. This is the Phase 9 white-label routing layer.
 *
 * Role-based authorization is NOT enforced here — there's no role data on the
 * edge without an extra round-trip. Pages call `requireRole(...)` themselves,
 * and RLS is the actual gate.
 */

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

const PUBLIC_PATHS = [
  "/login",
  "/verify-otp",
  "/auth/callback",
];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Hosts that are always treated as the platform's "control plane" and not a
// tenant — we never look these up in organization_domains.
const PLATFORM_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "smart-residential-platform.vercel.app",
  "srp.app",
  "www.srp.app",
]);

async function resolveTenantByHost(host: string): Promise<string | null> {
  const normalized = host.split(":")[0]!.toLowerCase();
  if (PLATFORM_HOSTS.has(normalized)) return null;

  try {
    // Anonymous client — `organization_domains` SELECT policy allows anon
    // reads precisely to support this middleware lookup.
    const supabase = createServerClient(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll: () => [], setAll: () => {} } },
    );
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

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Unauthenticated users on protected routes → /login (preserve target)
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated users on /login → /dashboard
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Tenant resolution by host. Only run for non-API, non-static routes to
  // avoid blowing up the request budget.
  const host = request.headers.get("host");
  if (host && !pathname.startsWith("/api/") && !pathname.startsWith("/_next/")) {
    const tenantId = await resolveTenantByHost(host);
    response.headers.set("x-srp-host", host);
    if (tenantId) response.headers.set("x-srp-tenant-id", tenantId);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
