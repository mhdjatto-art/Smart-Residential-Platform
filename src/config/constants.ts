/**
 * Cross-cutting constants reused across server + client code.
 * Pure constants only — no functions, no imports.
 */

/**
 * ISO-4217 currency codes that Stripe treats as zero-decimal
 * (i.e. amount is passed as integer of the major unit, no /100).
 *
 * Authoritative list: https://stripe.com/docs/currencies#zero-decimal
 *
 * IQD is NOT on Stripe's zero-decimal list but we use it as-is for display
 * (no fils sub-unit in commerce). For Stripe charges in IQD, the amount
 * is multiplied by 100 like any other currency.
 */
export const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  "bif","clp","djf","gnf","jpy","kmf","krw","mga",
  "pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf",
]);

export function isZeroDecimal(currencyCode: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(currencyCode.toLowerCase());
}

/** Convert a major-unit amount → Stripe smallest unit (integer). */
export function toStripeAmount(amount: number, currencyCode: string): number {
  return isZeroDecimal(currencyCode) ? Math.round(amount) : Math.round(amount * 100);
}

/** Convert a Stripe smallest unit (integer) → major-unit number. */
export function fromStripeAmount(cents: number, currencyCode: string): number {
  return isZeroDecimal(currencyCode) ? cents : cents / 100;
}
