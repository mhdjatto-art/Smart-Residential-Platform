/**
 * AsiaHawala (AsiaPay) adapter — Iraqi mobile-money & remittance gateway.
 *
 * Required env vars:
 *
 *   ASIAPAY_API_BASE       — https://api.asiahawala.com    (default)
 *   ASIAPAY_MERCHANT_ID
 *   ASIAPAY_API_KEY
 *   ASIAPAY_WEBHOOK_SECRET
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentGateway, CheckoutInput, CheckoutResult, WebhookEvent } from "./types";

const DEFAULT_BASE = "https://api.asiahawala.com";

export const asiapayGateway: PaymentGateway = {
  code: "asiapay",

  isConfigured() {
    return !!(process.env.ASIAPAY_MERCHANT_ID && process.env.ASIAPAY_API_KEY && process.env.ASIAPAY_WEBHOOK_SECRET);
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const merchantId = process.env.ASIAPAY_MERCHANT_ID!;
    const apiKey     = process.env.ASIAPAY_API_KEY!;
    const base       = process.env.ASIAPAY_API_BASE ?? DEFAULT_BASE;
    if (!this.isConfigured()) throw new Error("AsiaPay is not configured");

    const res = await fetch(`${base}/v1/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant:  merchantId,
        amount:    Math.round(input.amount),
        currency:  input.currency.toUpperCase(),
        reference: input.externalRef,
        callback:  input.webhookUrl,
        success:   input.successUrl,
        cancel:    input.cancelUrl,
        customer:  { phone: input.customerPhone, email: input.customerEmail },
        description: input.description,
      }),
    });
    const json = (await res.json()) as { id?: string; pay_url?: string; error?: { message?: string } };
    if (!res.ok || !json.id || !json.pay_url) {
      throw new Error(`AsiaPay checkout error: ${json.error?.message ?? `HTTP ${res.status}`}`);
    }
    return { checkoutUrl: json.pay_url, gatewayRef: json.id };
  },

  verifyWebhook(rawBody: string, headers: Headers): boolean {
    const secret = process.env.ASIAPAY_WEBHOOK_SECRET;
    const sig    = headers.get("x-asiapay-signature");
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
      id?: string; event?: string; reference?: string;
      status?: "succeeded" | "failed" | "pending" | "refunded";
      amount?: number; currency?: string; paid_at?: string;
    };
    return {
      externalRef:  event.reference ?? "",
      gatewayRef:   event.id ?? "",
      amount:       event.amount ?? 0,
      currency:     (event.currency ?? "iqd").toLowerCase(),
      status:       event.status ?? "pending",
      rawEventType: event.event ?? `asiapay.${event.status ?? "unknown"}`,
      paidAt:       event.paid_at ? new Date(event.paid_at) : undefined,
    };
  },
};
