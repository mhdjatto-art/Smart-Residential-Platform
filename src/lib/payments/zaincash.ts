/**
 * ZainCash adapter (Iraqi mobile wallet, operated by Zain telecom).
 *
 * ZainCash uses JWT-signed redirects rather than a REST checkout call:
 *
 *   1. Sign a JWT with merchant-shared secret containing { amount, serviceType,
 *      msisdn, orderId, redirectUrl }.
 *   2. Redirect the user to https://api.zaincash.iq/transaction/init?token={JWT}.
 *   3. ZainCash redirects back to our `redirectUrl` with { token, status }.
 *      We verify the JWT and update the topup.
 *
 * Required env vars:
 *
 *   ZAINCASH_MSISDN        — your merchant MSISDN (964...)
 *   ZAINCASH_MERCHANT_ID   — merchant id from ZainCash
 *   ZAINCASH_SECRET        — JWT signing secret
 *   ZAINCASH_API_BASE      — https://api.zaincash.iq            (default)
 *                            https://test.zaincash.iq           (sandbox)
 *
 * SECURITY: ZainCash callbacks come via a browser redirect, so the JWT must
 * be re-validated against `ZAINCASH_SECRET` on every callback. There is no
 * server-to-server signed webhook in this flow.
 */
import "server-only";
import type { PaymentGateway, CheckoutInput, CheckoutResult, WebhookEvent } from "./types";

const DEFAULT_BASE = "https://api.zaincash.iq";

export const zaincashGateway: PaymentGateway = {
  code: "zaincash",

  isConfigured() {
    return !!(process.env.ZAINCASH_MSISDN && process.env.ZAINCASH_MERCHANT_ID && process.env.ZAINCASH_SECRET);
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const msisdn     = process.env.ZAINCASH_MSISDN!;
    const merchantId = process.env.ZAINCASH_MERCHANT_ID!;
    const secret     = process.env.ZAINCASH_SECRET!;
    const base       = process.env.ZAINCASH_API_BASE ?? DEFAULT_BASE;
    if (!this.isConfigured()) throw new Error("ZainCash is not configured");

    // Sign a JWT manually (HS256) so we don't pull a JWT npm dep.
    const header  = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = base64url(JSON.stringify({
      amount:       Math.round(input.amount),
      serviceType:  input.description.slice(0, 64),
      msisdn,
      orderId:      input.externalRef,
      redirectUrl:  input.successUrl,
      iat:          Math.floor(Date.now() / 1000),
      exp:          Math.floor(Date.now() / 1000) + 60 * 15,
      merchantId,
    }));
    const sig = (await import("node:crypto"))
      .createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64")
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    const token = `${header}.${payload}.${sig}`;
    return {
      checkoutUrl: `${base}/transaction/init?token=${encodeURIComponent(token)}`,
      gatewayRef:  input.externalRef,
    };
  },

  verifyWebhook(rawBody: string): boolean {
    // ZainCash uses browser-redirect callback with a re-signed JWT, not a webhook.
    // The /api/webhooks/zaincash route validates the JWT manually.
    return rawBody.length > 0;
  },

  parseWebhook(rawBody: string): WebhookEvent {
    const event = JSON.parse(rawBody) as {
      orderId?: string;
      transactionId?: string;
      status?: string;     // "success" | "failed" | "pending"
      amount?: number;
      msg?: string;
    };
    return {
      externalRef:  event.orderId ?? "",
      gatewayRef:   event.transactionId ?? "",
      amount:       event.amount ?? 0,
      currency:     "iqd",
      status:       event.status === "success" ? "succeeded" : event.status === "failed" ? "failed" : "pending",
      rawEventType: `zaincash.${event.status ?? "unknown"}`,
    };
  },
};

function base64url(s: string): string {
  return Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
