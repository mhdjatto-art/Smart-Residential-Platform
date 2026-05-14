/**
 * Stripe adapter — wraps the existing `stripe.ts` helpers to conform to the
 * unified `PaymentGateway` interface (Phase 14).
 *
 * For Stripe we use Hosted Checkout. Stripe stores our `externalRef` as
 * `client_reference_id` AND `metadata.external_ref`, so we can recover it
 * from either field at webhook time.
 */
import "server-only";
import { createCheckoutSession, isStripeConfigured, verifyWebhookSignature } from "./stripe";
import type { PaymentGateway, CheckoutInput, CheckoutResult, WebhookEvent } from "./types";

export const stripeGateway: PaymentGateway = {
  code: "stripe",

  isConfigured() {
    return isStripeConfigured();
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const session = await createCheckoutSession({
      bill_id: input.externalRef,           // reused field — Stripe stores as client_reference_id
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      customer_email: input.customerEmail,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
    return {
      checkoutUrl: session.url,
      gatewayRef: session.id,
    };
  },

  verifyWebhook(rawBody: string, headers: Headers): boolean {
    return verifyWebhookSignature(rawBody, headers.get("stripe-signature"));
  },

  parseWebhook(rawBody: string): WebhookEvent {
    const event = JSON.parse(rawBody) as {
      id: string;
      type: string;
      data: {
        object: {
          id: string;
          client_reference_id?: string;
          amount_total?: number;
          currency?: string;
          metadata?: Record<string, string>;
          payment_status?: string;
          status?: string;
          created?: number;
        };
      };
    };

    const obj = event.data.object;
    const externalRef = obj.client_reference_id ?? obj.metadata?.external_ref ?? "";
    const amountMinor = obj.amount_total ?? 0;
    const currency = (obj.currency ?? "iqd").toLowerCase();
    // Stripe sends zero-decimal currencies as the major unit already.
    const ZERO_DECIMAL = new Set([
      "bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf",
    ]);
    const amount = ZERO_DECIMAL.has(currency) ? amountMinor : amountMinor / 100;

    const success = event.type === "checkout.session.completed" && obj.payment_status === "paid";
    const failed  = event.type === "checkout.session.expired" || obj.status === "expired";

    return {
      externalRef,
      gatewayRef: obj.id,
      amount,
      currency,
      status: success ? "succeeded" : failed ? "failed" : "pending",
      rawEventType: event.type,
      paidAt: obj.created ? new Date(obj.created * 1000) : undefined,
    };
  },
};
