/**
 * Qi Card adapter — Iraqi payroll/payment card by International Smart Card.
 *
 * Qi Card has two integration paths:
 *   - "InstantPay" REST API (server-to-server, similar to NASS)
 *   - "Switch" hosted-form (3DS) for card-present transactions
 *
 * This file targets InstantPay; switch to the Switch path if your merchant
 * agreement requires it.
 *
 * Required env vars:
 *
 *   QICARD_API_BASE        — https://api.qi.iq           (default)
 *   QICARD_MERCHANT_ID
 *   QICARD_API_KEY
 *   QICARD_WEBHOOK_SECRET
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentGateway, CheckoutInput, CheckoutResult, WebhookEvent } from "./types";

const DEFAULT_BASE = "https://api.qi.iq";

export const qicardGateway: PaymentGateway = {
  code: "qicard",

  isConfigured() {
    return !!(process.env.QICARD_MERCHANT_ID && process.env.QICARD_API_KEY && process.env.QICARD_WEBHOOK_SECRET);
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const merchantId = process.env.QICARD_MERCHANT_ID!;
    const apiKey     = process.env.QICARD_API_KEY!;
    const base       = process.env.QICARD_API_BASE ?? DEFAULT_BASE;
    if (!this.isConfigured()) throw new Error("Qi Card is not configured");

    const res = await fetch(`${base}/instantpay/v1/sessions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant_id:  merchantId,
        amount:       Math.round(input.amount),
        currency:     input.currency.toUpperCase(),
        description:  input.description,
        order_ref:    input.externalRef,
        return_url:   input.successUrl,
        cancel_url:   input.cancelUrl,
        webhook_url:  input.webhookUrl,
      }),
    });
    const json = (await res.json()) as { session_id?: string; redirect_url?: string; error?: { message?: string } };
    if (!res.ok || !json.session_id || !json.redirect_url) {
      throw new Error(`Qi Card checkout error: ${json.error?.message ?? `HTTP ${res.status}`}`);
    }
    return { checkoutUrl: json.redirect_url, gatewayRef: json.session_id };
  },

  verifyWebhook(rawBody: string, headers: Headers): boolean {
    const secret = process.env.QICARD_WEBHOOK_SECRET;
    const sig    = headers.get("x-qicard-signature");
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
      session_id?: string; event?: string; order_ref?: string;
      status?: "succeeded" | "failed" | "pending" | "refunded";
      amount?: number; currency?: string; paid_at?: string;
    };
    return {
      externalRef:  event.order_ref ?? "",
      gatewayRef:   event.session_id ?? "",
      amount:       event.amount ?? 0,
      currency:     (event.currency ?? "iqd").toLowerCase(),
      status:       event.status ?? "pending",
      rawEventType: event.event ?? `qicard.${event.status ?? "unknown"}`,
      paidAt:       event.paid_at ? new Date(event.paid_at) : undefined,
    };
  },
};
