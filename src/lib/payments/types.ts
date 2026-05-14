/**
 * Unified Payment Gateway interface (Phase 14).
 *
 * Every supported payment provider implements `PaymentGateway`. The flow is:
 *
 *   1. UI calls POST /api/wallet/topup/{method} with { walletId, amount }
 *   2. The route builds an `externalRef` (used as idempotency key) and asks
 *      the right adapter for a hosted checkout URL.
 *   3. UI redirects the user to `result.checkoutUrl`.
 *   4. The gateway processes the payment.
 *   5. Gateway calls back to /api/webhooks/{provider}.
 *   6. The webhook route verifies the signature, parses the event, and
 *      calls the `topup_wallet` RPC with `p_external_ref = externalRef`.
 *      The RPC is idempotent on that key, so retries are safe.
 *
 * Each adapter only knows about its provider's protocol. The route handlers
 * and the wallet RPC are gateway-agnostic.
 */
import "server-only";

export type PaymentMethodCode =
  | "stripe"
  | "nass"
  | "qicard"
  | "fastpay"
  | "zaincash"
  | "asiapay";

export interface CheckoutInput {
  /** Idempotency key — we persist this to wallet_topups.external_reference. */
  externalRef: string;
  /** Internal wallet receiving the top-up. */
  walletId: string;
  /** Amount in major currency units (e.g. 25000 IQD, 5.00 USD). */
  amount: number;
  /** ISO 4217 currency code, lower-case (e.g. "iqd", "usd"). */
  currency: string;
  /** Human-readable description shown by the gateway to the payer. */
  description: string;
  /** Optional resident contact (used by some gateways for receipts). */
  customerEmail?: string;
  /** Optional resident phone (E.164, used by mobile wallets). */
  customerPhone?: string;
  /** Where to send the user after a successful payment. */
  successUrl: string;
  /** Where to send the user if they cancel. */
  cancelUrl: string;
  /** Public URL the gateway will POST the webhook to. */
  webhookUrl: string;
  /** Free-form key/value metadata round-tripped through the gateway. */
  metadata?: Record<string, string>;
}

export interface CheckoutResult {
  /** Browser-redirectable URL to begin checkout. */
  checkoutUrl: string;
  /** Gateway's own reference for this attempt. Stored in wallet_topups.payment_id. */
  gatewayRef: string;
  /** Optional deep-link for native apps (e.g. zaincash://pay?...). */
  deepLink?: string;
}

export interface WebhookEvent {
  /** Our `externalRef` — recovered from the gateway's metadata. */
  externalRef: string;
  /** Gateway's transaction ID. */
  gatewayRef: string;
  /** Amount paid (major units). */
  amount: number;
  /** Currency lower-case ISO. */
  currency: string;
  /** Normalized status across all gateways. */
  status: "succeeded" | "failed" | "pending" | "refunded";
  /** Raw event type from the gateway (e.g. "payment_intent.succeeded"). */
  rawEventType: string;
  /** When the payment was completed (if known). */
  paidAt?: Date;
}

export interface PaymentGateway {
  /** Matches the `code` column in `public.payment_method_registry`. */
  readonly code: PaymentMethodCode;

  /** True iff the required env vars are present (so the UI can hide unconfigured gateways). */
  isConfigured(): boolean;

  /** Build the hosted-checkout URL and return it. */
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;

  /** Validate the gateway's signature on a webhook body. */
  verifyWebhook(rawBody: string, headers: Headers): boolean;

  /** Parse a verified webhook body into our normalized event shape. */
  parseWebhook(rawBody: string): WebhookEvent;
}

/**
 * Build a deterministic, idempotent externalRef for a top-up attempt.
 * Format: `wallet:{walletId}:t:{unix_ms}:{nonce8}`
 */
export function buildExternalRef(walletId: string): string {
  const ts = Date.now();
  const nonce = Math.random().toString(36).slice(2, 10);
  return `wallet:${walletId}:t:${ts}:${nonce}`;
}
