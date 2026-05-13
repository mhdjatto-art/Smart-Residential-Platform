import { NextResponse } from "next/server";

/**
 * Fail-closed cron authentication.
 *
 * Returns null if the request is authorized to run a cron job; otherwise
 * returns a NextResponse the caller should propagate.
 *
 * Authorization sources (in order):
 *   1. `Authorization: Bearer <CRON_SECRET>` — used by Vercel Cron and external schedulers
 *   2. `x-vercel-cron-signature` header — Vercel sets this on managed crons; combined
 *      with the secret it doubles as proof the request came from Vercel infra
 *
 * Rules:
 *   - In production (NODE_ENV=production), if CRON_SECRET is missing OR the
 *     header doesn't match, we return 401. **Never open in production.**
 *   - In development (NODE_ENV !== production), if CRON_SECRET is unset we
 *     allow the call to make local testing painless. If the env var IS set,
 *     even dev requires a match.
 *
 * Always log a one-line summary so misconfiguration is visible in Vercel logs.
 */
export function requireCronAuth(request: Request, jobName: string): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  const auth   = request.headers.get("authorization");
  const isProd = process.env.NODE_ENV === "production";

  // Production: fail-closed.
  if (isProd) {
    if (!secret) {
      console.error(`[cron/${jobName}] BLOCKED — CRON_SECRET is not set in production`);
      return NextResponse.json(
        { error: "Cron not configured — CRON_SECRET missing" },
        { status: 503 },
      );
    }
    if (auth !== `Bearer ${secret}`) {
      console.warn(`[cron/${jobName}] BLOCKED — invalid or missing Authorization header`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
  }

  // Non-prod: if secret is set, enforce it; otherwise allow for local dev.
  if (secret && auth !== `Bearer ${secret}`) {
    console.warn(`[cron/${jobName}] BLOCKED (dev with secret set) — invalid Authorization header`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!secret) {
    console.warn(`[cron/${jobName}] DEV MODE — CRON_SECRET unset, allowing call`);
  }
  return null;
}
