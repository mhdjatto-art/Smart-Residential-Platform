/**
 * Phase 22 — Payment gateway adapter contract.
 *
 * Each provider (NASS, Qi Card, ZainCash, FastPay, AsiaHawala, Stripe, …)
 * implements this interface. The runtime picks the active adapter from
 * `payment_gateways` and calls it with the stored credentials.
 *
 * Adapters live in `src/lib/payments/adapters/<provider>.ts`.
 * Adding a new provider = three steps (no DB change needed beyond adding
 * the row through the admin UI):
 *
 *   1. Add the provider name to PROVIDER_REGISTRY below
 *   2. Create the adapter file under `adapters/<provider>.ts`
 *   3. Add the credential field definitions to CREDENTIAL_SCHEMA below
 *
 * That's it — `/master/gateways` will auto-render the new option.
 */

export type ProviderId =
  | "stripe"
  | "nass"
  | "qi_card"
  | "zaincash"
  | "fastpay"
  | "asiahawala"
  | "cash"
  | "bank_transfer"
  | "cheque"
  | "wallet";

export interface InitiatePaymentInput {
  /** Amount in major currency units (e.g. 1500 IQD or 52.50 USD). */
  amount:        number;
  currency:      string;
  /** What is being paid. Each adapter can use this to label the txn. */
  description:   string;
  /** Stable reference back to OUR records — the adapter forwards it in metadata. */
  reference:     string;
  /** Where to redirect the user after success (for hosted-page providers). */
  success_url:   string;
  cancel_url:    string;
  /** Optional customer info — adapter passes whatever it supports. */
  customer?: {
    email?: string;
    phone?: string;
    name?:  string;
  };
}

export interface InitiatePaymentResult {
  /** Provider's own txn id — store in `payments.external_reference`. */
  provider_txn_id: string;
  /** If the provider returns a hosted URL/QR — redirect the user here. */
  redirect_url?: string;
  /** If the provider returns a QR payload to display inline. */
  qr_payload?:   string;
  /** Adapter-specific extras (USSD code, deeplink, etc.). */
  extras?:       Record<string, unknown>;
}

export interface WebhookVerifyInput {
  raw_body:     string;
  headers:      Record<string, string>;
  /** Decrypted gateway credentials from DB. */
  credentials:  Record<string, unknown>;
}

export interface WebhookVerifyResult {
  /** True if signature/payload is authentic. */
  valid:          boolean;
  /** Parsed payment outcome — only present when valid && payment confirmed. */
  payment?: {
    provider_txn_id: string;
    amount:          number;
    currency:        string;
    /** OUR reference we passed during initiation. */
    reference:       string;
    status:          "succeeded" | "failed" | "pending";
  };
}

export interface PaymentAdapter {
  /** Adapter id — must match PROVIDER_REGISTRY entry. */
  provider: ProviderId;
  /** Display name shown in the admin UI (overridable per-row). */
  defaultDisplayName: string;
  /** Methods this adapter satisfies (drives the resident's Pay-dialog buttons). */
  supportedMethods: string[];
  /** Currencies this adapter accepts (empty = any). */
  supportedCurrencies: string[];
  /** Initiate a payment session. Returns redirect_url or qr_payload. */
  initiate(
    credentials: Record<string, unknown>,
    config:      Record<string, unknown>,
    input:       InitiatePaymentInput,
  ): Promise<InitiatePaymentResult>;
  /** Verify a webhook callback and return parsed payment info. */
  verifyWebhook(input: WebhookVerifyInput): Promise<WebhookVerifyResult>;
}

/**
 * Credential schema — drives the dynamic form in /master/gateways.
 * Each entry describes the fields the admin must fill when adding the provider.
 */
export interface CredentialField {
  key:         string;
  label:       string;
  type:        "text" | "password" | "url" | "select";
  required:    boolean;
  placeholder?: string;
  help?:       string;
  options?:    Array<{ value: string; label: string }>;
}

export const CREDENTIAL_SCHEMA: Record<ProviderId, CredentialField[]> = {
  stripe: [
    { key: "publishable_key", label: "Publishable Key", type: "text",     required: true, placeholder: "pk_live_...", help: "From Stripe Dashboard → Developers → API keys" },
    { key: "secret_key",      label: "Secret Key",      type: "password", required: true, placeholder: "sk_live_...", help: "Keep secret — only super_admin can view" },
    { key: "webhook_secret",  label: "Webhook Secret",  type: "password", required: false, placeholder: "whsec_...", help: "From Stripe Dashboard → Developers → Webhooks → your endpoint" },
  ],
  nass: [
    { key: "merchant_id",   label: "Merchant ID",  type: "text",     required: true,  placeholder: "NASS-XXXXX", help: "From NASS Pay merchant portal" },
    { key: "api_key",       label: "API Key",      type: "password", required: true,  help: "Provided by NASS support" },
    { key: "secret_key",    label: "Secret Key",   type: "password", required: true,  help: "Provided by NASS support — used for HMAC" },
    { key: "callback_url",  label: "Callback URL", type: "url",      required: false, placeholder: "https://your-domain/api/webhooks/nass", help: "Register this URL in NASS portal" },
    { key: "mode",          label: "Mode",         type: "select",   required: true,  options: [{value:"test",label:"Test"},{value:"live",label:"Live"}] },
  ],
  qi_card: [
    { key: "terminal_id",   label: "Terminal ID",  type: "text",     required: true, placeholder: "TID-XXXX" },
    { key: "merchant_key",  label: "Merchant Key", type: "password", required: true },
    { key: "secret_key",    label: "Secret Key",   type: "password", required: true },
    { key: "mode",          label: "Mode",         type: "select",   required: true, options: [{value:"test",label:"Test"},{value:"live",label:"Live"}] },
  ],
  zaincash: [
    { key: "msisdn",        label: "Merchant Phone (MSISDN)", type: "text",     required: true,  placeholder: "9647...", help: "ZainCash merchant phone number" },
    { key: "merchant_id",   label: "Merchant ID",  type: "text",     required: true },
    { key: "secret_key",    label: "Secret Key",   type: "password", required: true,  help: "JWT signing secret" },
    { key: "mode",          label: "Mode",         type: "select",   required: true,  options: [{value:"test",label:"Test"},{value:"live",label:"Live"}] },
  ],
  fastpay: [
    { key: "merchant_id",   label: "Merchant ID",  type: "text",     required: true },
    { key: "api_token",     label: "API Token",    type: "password", required: true },
    { key: "secret_key",    label: "Secret Key",   type: "password", required: false },
    { key: "mode",          label: "Mode",         type: "select",   required: true,  options: [{value:"test",label:"Test"},{value:"live",label:"Live"}] },
  ],
  asiahawala: [
    { key: "merchant_id",   label: "Merchant ID",  type: "text",     required: true },
    { key: "api_key",       label: "API Key",      type: "password", required: true },
    { key: "secret_key",    label: "Secret Key",   type: "password", required: true },
    { key: "mode",          label: "Mode",         type: "select",   required: true,  options: [{value:"test",label:"Test"},{value:"live",label:"Live"}] },
  ],
  // The four below are always-on internal "providers" with no credentials.
  cash:           [],
  bank_transfer:  [],
  cheque:         [],
  wallet:         [],
};

/**
 * Friendly labels for the admin UI provider picker.
 */
export const PROVIDER_LABELS: Record<ProviderId, string> = {
  stripe:        "Stripe (International cards)",
  nass:          "NASS Pay (Iraq)",
  qi_card:       "Qi Card (Iraq)",
  zaincash:      "ZainCash (Iraq mobile wallet)",
  fastpay:       "FastPay (Iraq)",
  asiahawala:    "AsiaHawala (Iraq)",
  cash:          "Cash (in-office)",
  bank_transfer: "Bank Transfer",
  cheque:        "Cheque",
  wallet:        "In-app Wallet",
};

/** Always-on built-in providers — can be toggled but not deleted. */
export const BUILTIN_PROVIDERS: ProviderId[] = ["cash", "bank_transfer", "cheque", "wallet"];

/** Real online providers that require credentials. */
export const ONLINE_PROVIDERS: ProviderId[] = ["stripe", "nass", "qi_card", "zaincash", "fastpay", "asiahawala"];
