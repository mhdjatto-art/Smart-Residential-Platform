"use server";

/**
 * Server-side rate limit checks for auth endpoints (login, OTP).
 * Called from client-side forms before invoking Supabase Auth, so the
 * server enforces the cap even though Supabase Auth itself runs client-side.
 */

import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const LOGIN_LIMIT      = 5;            // attempts per window
const LOGIN_WINDOW_MS  = 15 * 60_000;  // 15 min

const OTP_LIMIT        = 3;            // OTP requests per window
const OTP_WINDOW_MS    = 30 * 60_000;  // 30 min

export interface RateGateResult {
  allowed:    boolean;
  retryAfter: number;  // seconds
  message?:   string;
}

async function callerIp(): Promise<string> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
    return h.get("x-real-ip") ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Rate gate for /login — keyed by IP AND email (whichever hits first wins). */
export async function checkLoginRate(email: string): Promise<RateGateResult> {
  const ip = await callerIp();
  const byIp    = rateLimit(`login:ip:${ip}`,                LOGIN_LIMIT, LOGIN_WINDOW_MS);
  const byEmail = rateLimit(`login:email:${email.toLowerCase()}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);

  if (!byIp.ok || !byEmail.ok) {
    const reset = Math.max(byIp.resetAt, byEmail.resetAt);
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    logger.warn("auth-rate", `login throttled ip=${ip} email=${email}`);
    return {
      allowed: false,
      retryAfter,
      message: `Too many login attempts. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
    };
  }
  return { allowed: true, retryAfter: 0 };
}

/** Rate gate for OTP / verify-otp — keyed by email primarily. */
export async function checkOtpRate(email: string): Promise<RateGateResult> {
  const ip = await callerIp();
  const byIp    = rateLimit(`otp:ip:${ip}`,                  OTP_LIMIT, OTP_WINDOW_MS);
  const byEmail = rateLimit(`otp:email:${email.toLowerCase()}`, OTP_LIMIT, OTP_WINDOW_MS);

  if (!byIp.ok || !byEmail.ok) {
    const reset = Math.max(byIp.resetAt, byEmail.resetAt);
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    logger.warn("auth-rate", `otp throttled ip=${ip} email=${email}`);
    return {
      allowed: false,
      retryAfter,
      message: `Too many OTP requests. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
    };
  }
  return { allowed: true, retryAfter: 0 };
}
