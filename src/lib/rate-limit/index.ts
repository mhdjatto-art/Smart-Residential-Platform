import { NextResponse } from "next/server";

/**
 * Lightweight in-memory token bucket. Per-key fixed-window counter.
 *
 * Trade-offs:
 *   • No external dep (Upstash etc.) — works on Vercel Free tier.
 *   • Per-instance: with horizontal scaling, each lambda has its own counter.
 *     For SRP's current scale this is fine; we can upgrade to Upstash Redis
 *     when traffic warrants. The point of THIS limiter is to stop trivial
 *     brute-force attacks, not to be a global quota.
 *   • LRU-style cap on map size (5000 keys) so we don't leak memory.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const STORE = new Map<string, Bucket>();
const MAX_KEYS = 5000;

function prune(now: number) {
  if (STORE.size < MAX_KEYS) return;
  // Drop the oldest 20% by resetAt
  const sorted = [...STORE.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
  const drop = Math.floor(sorted.length * 0.2);
  for (let i = 0; i < drop; i++) STORE.delete(sorted[i][0]);
  // Also drop anything already expired
  for (const [k, v] of STORE) if (v.resetAt <= now) STORE.delete(k);
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check + increment the bucket for `key`. Returns `ok=false` when over limit.
 *
 * @param key      unique bucket id, e.g. `login:<email>` or `login:<ip>`
 * @param limit    max requests per window
 * @param windowMs window size in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  prune(now);

  const existing = STORE.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    STORE.set(key, bucket);
    return { ok: true, remaining: limit - 1, resetAt: bucket.resetAt };
  }
  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count++;
  return { ok: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/**
 * Extracts a stable identifier for the caller. Prefers the first IP in
 * X-Forwarded-For (set by Vercel's edge), falls back to a generic "unknown".
 */
export function ipFromRequest(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/**
 * Convenience: enforce a limit and return a 429 NextResponse if exceeded,
 * else null (caller proceeds).
 */
export function enforceRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const ip = ipFromRequest(request);
  const key = `${bucket}:${ip}`;
  const res = rateLimit(key, limit, windowMs);
  if (!res.ok) {
    const retryAfter = Math.max(1, Math.ceil((res.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(res.resetAt / 1000)),
        },
      },
    );
  }
  return null;
}
