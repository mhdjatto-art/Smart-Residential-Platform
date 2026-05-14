/**
 * FastPay adapter (Iraqi e-wallet by Faylasoof).
 *
 * Required env vars:
 *
 *   FASTPAY_API_BASE       — https://api.fast-pay.iq         (default)
 *   FASTPAY_MERCHANT_ID
 *   FASTPAY_API_KEY
 *   FASTPAY_WEBHOOK_SECRET — HMAC-SHA256 webhook signing key
 *
 * Flow mirrors NASS (REST checkout + signed callback). When you confirm the
 * exact endpoint path with FastPay support, just adjust the URL on the
 * `fetch` line below.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentGateway, CheckoutInput, CheckoutResult, WebhookEvent } from "./types";

const DEFAULT_BASE = "https://api.fast-pay.iq";

export const fastpayGateway: PaymentGateway = {
  code: "fastpay",

  isConfigured() {
    return !!(process.env.FASTPAY_MERCHANT_ID && process.env.FASTPAY_API_KEY && process.env.FASTPAY_WEBHOOK_SECRET);
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const merchantId = process.env.FASTPAY_MERCHANT_ID!;
    const apiKey     = process.env.FASTPAY_API_KEY!;
    const base       = process.env.FASTPAY_API_BASE ?? DEFAULT_BASE;
    if (!this.isConfigured()) throw new Error("FastPay is not configured");

    const res = await fetch(`${base}/v1/checkout`, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        merchant_id:  merchantId,
        amount:       Math.round(input.amount),
        currency:     input.currency.toUpperCase(),
        order_id:     input.externalRef,
        description:  input.description,
        callback_url: input.webhookUrl,
        success_url:  input.successUrl,
        cancel_url:   input.cancelUrl,
        customer_phone: input.customerPhone,
        customer_email: input.customerEmail,
      }),
    });
    const json = (await res.json()) as { id?: string; redirect_url?: string; error?: { message?: string } };
    if (!res.ok || !json.id || !json.redirect_url) {
      throw new Error(`FastPay checkout error: ${json.error?.message ?? `HTTP ${res.status}`}`);
    }
    return { checkoutUrl: json.redirect_url, gatewayRef: json.id };
  },

  verifyWebhook(rawBody: string, headers: Headers): boolean {
    const secret = process.env.FASTPAY_WEBHOOK_SECRET;
    const sig    = headers.get("x-fastpay-signature");
    if (!secret || !sig) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    try {
      const a = Buffer.from(sig, "hex");
      const b = Buffer.from(expected, "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  },

  parseWebhook(rawBody: string): WebhookEvent {
    const event = JSON.parse(rawBody) as {
      id?: string;
      event?: string;
      order_id?: string;
      status?: "succeeded" | "failed" | "pending" | "refunded";
      amount?: number;
      currency?: string;
      paid_at?: string;
    };
    return {
      externalRef:  event.order_id ?? "",
      gatewayRef:   event.id ?? "",
      amount:       event.amount ?? 0,
      currency:     (event.currency ?? "iqd").toLowerCase(),
      status:       event.status ?? "pending",
      rawEventType: event.event ?? `fastpay.${event.status ?? "unknown"}`,
      paidAt:       event.paid_at ? new Date(event.paid_at) : undefined,
    };
  },
};
