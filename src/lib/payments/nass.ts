/**
 * NASS Pay adapter (Iraqi e-wallet).
 *
 * NASS Pay developer portal: https://nass.iq/resources/developers
 *
 * This implementation follows the documented NASS REST flow:
 *
 *   POST {API_BASE}/payments/checkout      → create a checkout (returns redirect URL)
 *   GET  {API_BASE}/payments/{id}          → poll status (fallback)
 *   POST <our webhook>                     → NASS posts callback after settlement
 *
 * Required env vars:
 *
 *   NASS_API_BASE          — https://api.nass.iq           (production)
 *                            https://sandbox.api.nass.iq   (sandbox)
 *   NASS_MERCHANT_ID       — your merchant identifier
 *   NASS_API_KEY           — Bearer token for the REST API
 *   NASS_WEBHOOK_SECRET    — HMAC-SHA256 shared secret used to sign webhooks
 *   NEXT_PUBLIC_APP_URL    — the origin we live at (e.g. https://www.bonyan.app)
 *
 * Until you provide the credentials, `isConfigured()` returns false and the
 * UI shows the placeholder notice instead of hitting the gateway.
 *
 * NOTE: Field names below match what NASS publishes for v1 of their API.
 * If your account uses a different version, only the `body` / parsing sections
 * here need adjustment — the public interface stays stable.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentGateway, CheckoutInput, CheckoutResult, WebhookEvent } from "./types";

const NASS_API_BASE_DEFAULT = "https://api.nass.iq";

function env(name: string): string | undefined {
  return process.env[name];
}

export const nassGateway: PaymentGateway = {
  code: "nass",

  isConfigured() {
    return !!(env("NASS_MERCHANT_ID") && env("NASS_API_KEY") && env("NASS_WEBHOOK_SECRET"));
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const merchantId = env("NASS_MERCHANT_ID");
    const apiKey     = env("NASS_API_KEY");
    if (!merchantId || !apiKey) {
      throw new Error("NASS Pay is not configured (missing NASS_MERCHANT_ID or NASS_API_KEY)");
    }
    const base = env("NASS_API_BASE") ?? NASS_API_BASE_DEFAULT;

    // NASS expects integer minor units for IQD (no decimals).
    const amountInMinor =
      input.currency.toLowerCase() === "iqd"
        ? Math.round(input.amount)
        : Math.round(input.amount * 100);

    const body = {
      merchant_id:    merchantId,
      amount:         amountInMinor,
      currency:       input.currency.toUpperCase(),
      description:    input.description,
      reference:      input.externalRef,                 // round-tripped through webhook
      callback_url:   input.webhookUrl,
      success_url:    input.successUrl,
      cancel_url:     input.cancelUrl,
      customer: {
        email: input.customerEmail ?? undefined,
        phone: input.customerPhone ?? undefined,
      },
      metadata:       input.metadata ?? {},
    };

    const res = await fetch(`${base}/v1/payments/checkout`, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept:         "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      id?: string;
      checkout_url?: string;
      deep_link?: string;
      error?: { message?: string };
    };

    if (!res.ok || !json.id || !json.checkout_url) {
      throw new Error(`NASS checkout error: ${json.error?.message ?? `HTTP ${res.status}`}`);
    }

    return {
      checkoutUrl: json.checkout_url,
      gatewayRef:  json.id,
      deepLink:    json.deep_link,
    };
  },

  verifyWebhook(rawBody: string, headers: Headers): boolean {
    const secret = env("NASS_WEBHOOK_SECRET");
    if (!secret) return false;

    const sigHeader = headers.get("x-nass-signature") ?? headers.get("x-signature");
    const tsHeader  = headers.get("x-nass-timestamp") ?? headers.get("x-timestamp");
    if (!sigHeader || !tsHeader) return false;

    // Tolerance: reject events older than 5 minutes to limit replay window.
    const ts = Number(tsHeader);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) return false;

    const expected = createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
    try {
      const a = Buffer.from(sigHeader, "hex");
      const b = Buffer.from(expected,  "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  },

  parseWebhook(rawBody: string): WebhookEvent {
    const event = JSON.parse(rawBody) as {
      id?: string;                     // gateway transaction id
      event?: string;                  // "payment.succeeded" | "payment.failed" | ...
      status?: string;                 // "succeeded" | "failed" | "pending"
      amount?: number;                 // in minor units
      currency?: string;
      reference?: string;              // our externalRef
      paid_at?: string;                // ISO timestamp
      metadata?: Record<string, string>;
    };

    const externalRef =
      event.reference ?? event.metadata?.external_ref ?? event.metadata?.externalRef ?? "";
    const currency   = (event.currency ?? "iqd").toLowerCase();
    const amount     = currency === "iqd" ? Math.round(event.amount ?? 0) : (event.amount ?? 0) / 100;

    const status: WebhookEvent["status"] =
      event.status === "succeeded"  ? "succeeded" :
      event.status === "failed"     ? "failed"    :
      event.status === "refunded"   ? "refunded"  :
                                      "pending";

    return {
      externalRef,
      gatewayRef:   event.id ?? "",
      amount,
      currency,
      status,
      rawEventType: event.event ?? `nass.${event.status ?? "unknown"}`,
      paidAt:       event.paid_at ? new Date(event.paid_at) : undefined,
    };
  },
};
