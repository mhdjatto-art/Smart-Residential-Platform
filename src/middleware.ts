/**
 * Edge middleware — runs on every matched request before the route handler.
 *
 * Responsibilities:
 *   1. Refresh the Supabase auth session cookie (delegated to `updateSession`).
 *   2. Redirect unauthenticated users away from protected routes.
 *   3. Redirect authenticated users away from /login back to the dashboard.
 *
 * Role-based authorization is NOT enforced here — there's no role data on the
 * edge without an extra round-trip. Pages call `requireRole(...)` themselves,
 * and RLS is the actual gate.
 */

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = [
  "/login",
  "/verify-otp", // kept public so the redirect inside it can run
  "/auth/callback",
];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
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

  return response;
}

export const config = {
  /**
   * Match every path except:
   *   - Next.js internals (_next/static, _next/image)
   *   - favicon / robots / sitemap
   *   - the auth callback (handled by its own route)
   *
   * Static asset extensions are excluded so we don't burn a Supabase call per
   * image request.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
