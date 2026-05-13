/**
 * Minimal Stripe API client — no npm dependency.
 *
 * We talk to Stripe via plain HTTPS so the project doesn't have to add
 * the `stripe` package to package.json. Two functions:
 *
 *   createCheckoutSession()    — opens a hosted checkout for a utility bill
 *   verifyWebhookSignature()   — validates the Stripe-Signature header
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY          — sk_test_... or sk_live_...
 *   STRIPE_WEBHOOK_SECRET      — whsec_...
 *   NEXT_PUBLIC_APP_URL        — the public origin (https://...vercel.app)
 *
 * If STRIPE_SECRET_KEY is missing, isStripeConfigured() returns false and
 * the UI falls back to the "direct pay" path we built earlier.
 */

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export interface CheckoutSession {
  id: string;
  url: string;
  payment_intent: string | null;
}

interface CreateCheckoutInput {
  bill_id: string;
  amount: number;             // in major units (e.g. 52.50)
  currency: string;           // ISO 4217 ('usd', 'iqd', ...)
  description: string;        // e.g. "Electricity bill — A-101"
  customer_email?: string;
  success_url: string;
  cancel_url: string;
}

export async function createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");

  // Stripe accepts amounts as integers in the smallest currency unit.
  // Zero-decimal currencies (IQD doesn't have cents per Stripe's list).
  const ZERO_DECIMAL = new Set([
    "bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf",
  ]);
  const ccy = input.currency.toLowerCase();
  const cents = ZERO_DECIMAL.has(ccy) ? Math.round(input.amount) : Math.round(input.amount * 100);

  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("success_url", input.success_url);
  params.append("cancel_url", input.cancel_url);
  if (input.customer_email) params.append("customer_email", input.customer_email);
  params.append("metadata[bill_id]", input.bill_id);
  params.append("client_reference_id", input.bill_id);
  params.append("line_items[0][quantity]", "1");
  params.append("line_items[0][price_data][currency]", ccy);
  params.append("line_items[0][price_data][unit_amount]", String(cents));
  params.append("line_items[0][price_data][product_data][name]", input.description);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const json = (await res.json()) as { id?: string; url?: string; payment_intent?: string; error?: { message?: string } };
  if (!res.ok || !json.id || !json.url) {
    throw new Error(`Stripe checkout error: ${json.error?.message ?? `HTTP ${res.status}`}`);
  }
  return {
    id: json.id,
    url: json.url,
    payment_intent: json.payment_intent ?? null,
  };
}

/**
 * Verify a Stripe webhook signature.
 *
 * Implements the docs at https://stripe.com/docs/webhooks/signatures
 * Returns true if the signature matches and is within the tolerance window.
 */
export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string | null,
  toleranceSeconds: number = 300,
): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signatureHeader) return false;

  // Parse header: "t=1234567890,v1=hex1,v1=hex2"
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const idx = p.indexOf("=");
      return idx === -1 ? [p, ""] : [p.slice(0, idx), p.slice(idx + 1)];
    }),
  );
  const ts = parts.t;
  const sigs = signatureHeader
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!ts || sigs.length === 0) return false;

  // Tolerance check
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(ts)) > toleranceSeconds) return false;

  // Compute expected
  const expected = createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");

  return sigs.some((sig) => {
    try {
      const sigBuf = Buffer.from(sig, "hex");
      if (sigBuf.length !== expectedBuf.length) return false;
      return timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  });
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}
