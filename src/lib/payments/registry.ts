/**
 * Payment-gateway registry. Maps `payment_method_registry.code` →
 * the concrete adapter implementing the unified `PaymentGateway` interface.
 *
 * Add a new gateway by:
 *   1. Creating an adapter that implements `PaymentGateway` in this folder.
 *   2. Importing it here and adding it to the `GATEWAYS` map.
 *   3. Adding its code to `PaymentMethodCode` in ./types.ts.
 *   4. Registering it in `payment_method_registry` (INSERT … or via the
 *      organization settings UI).
 */
import "server-only";
import type { PaymentGateway, PaymentMethodCode } from "./types";
import { stripeGateway }   from "./stripe-gateway";
import { nassGateway }     from "./nass";
import { fastpayGateway }  from "./fastpay";
import { zaincashGateway } from "./zaincash";
import { asiapayGateway }  from "./asiapay";
import { qicardGateway }   from "./qicard";

const GATEWAYS: Record<PaymentMethodCode, PaymentGateway> = {
  stripe:   stripeGateway,
  nass:     nassGateway,
  qicard:   qicardGateway,
  fastpay:  fastpayGateway,
  zaincash: zaincashGateway,
  asiapay:  asiapayGateway,
};

const ALL_CODES = Object.keys(GATEWAYS) as PaymentMethodCode[];

export function isKnownGateway(code: string): code is PaymentMethodCode {
  return (ALL_CODES as string[]).includes(code);
}

export function getGateway(code: string): PaymentGateway {
  if (!isKnownGateway(code)) throw new Error(`Unknown payment gateway: ${code}`);
  return GATEWAYS[code];
}

/** Return the list of gateway codes whose env vars are present. */
export function listConfiguredGateways(): PaymentMethodCode[] {
  return ALL_CODES.filter((c) => GATEWAYS[c].isConfigured());
}

/** Return the list of all known gateway codes. */
export function listAllGateways(): PaymentMethodCode[] {
  return [...ALL_CODES];
}
