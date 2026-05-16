/**
 * Unified webhook receiver for all payment gateways.
 *
 *   POST /api/webhooks/{provider}
 *
 * The route:
 *   1. Reads the raw body (we don't parse it before signature verification).
 *   2. Asks the adapter to verify the signature/integrity of the payload.
 *   3. Asks the adapter to parse the event into our normalized shape.
 *   4. For a successful payment, calls the `topup_wallet` RPC with the
 *      `external_reference` so idempotency holds across retries.
 *   5. Always returns 200 once we've recorded what we can — gateways retry
 *      on non-2xx and we don't want to amplify retries for events we've
 *      already processed.
 *
 * Note: we do NOT call this directly from Stripe. Stripe has its own
 * dedicated route at /api/webhooks/stripe that we kept for backward
 * compatibility. New gateways go through this unified handler.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGateway, isKnownGateway } from "@/lib/payments/registry";
import { getErrorMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isKnownGateway(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  // Stripe has its own legacy route — short-circuit so we don't process events twice.
  if (provider === "stripe") {
    return NextResponse.json({ error: "Use /api/webhooks/stripe" }, { status: 410 });
  }

  const gateway = getGateway(provider);

  // 1. Read raw body — must happen before any JSON parsing for signature verification.
  const rawBody = await request.text();
  const headers = request.headers;

  // 2. Verify signature.
  if (!gateway.verifyWebhook(rawBody, headers)) {
    logger.warn(`webhook/${provider}`, "signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 3. Parse normalized event.
  let event;
  try {
    event = gateway.parseWebhook(rawBody);
  } catch (e) {
    logger.error(`webhook/${provider}`, "parse error", e);
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  if (!event.externalRef) {
    logger.error(`webhook/${provider}`, "missing externalRef — cannot match wallet");
    return NextResponse.json({ ok: true, note: "no externalRef" });
  }

  // 4. If the payment succeeded, credit the wallet via the idempotent RPC.
  if (event.status === "succeeded" && event.amount > 0) {
    const supabase = await createClient();

    // We need the wallet_id to call topup_wallet. Recover it from the
    // externalRef format: "wallet:{walletId}:t:...:..."
    const parts = event.externalRef.split(":");
    const walletId = parts[0] === "wallet" ? parts[1] : null;
    if (!walletId) {
      logger.error(`webhook/${provider}`, `malformed externalRef: ${event.externalRef}`);
      return NextResponse.json({ ok: true });
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("topup_wallet", {
        p_wallet_id:       walletId,
        p_amount:          event.amount,
        p_method:          provider,
        p_payment_id:      event.gatewayRef,
        p_external_ref:    event.externalRef,
        p_idempotency_key: event.externalRef,        // RPC dedupes on this
        p_notes:           `Settled via ${provider} (${event.rawEventType})`,
      });
      if (error) {
        const msg = getErrorMessage(error);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const code = (error as any)?.code;
        if (code === "23505" || msg.includes("duplicate key")) {
          logger.info(`webhook/${provider}`, "duplicate top-up suppressed");
        } else {
          logger.error(`webhook/${provider}`, `topup_wallet failed: ${msg}`, error);
        }
      } else {
        // Best-effort: restore service if it was cut off.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).rpc("restore_after_topup", { p_wallet_id: walletId }).catch((err: unknown) => {
          logger.warn(`webhook/${provider}`, "restore_after_topup failed", err);
        });
      }
    } catch (e) {
      logger.error(`webhook/${provider}`, "RPC error", e);
    }
  }

  // For other statuses we just log — no balance change needed.
  if (event.status !== "succeeded") {
    logger.info(`webhook/${provider}`, `non-success event status=${event.status} ref=${event.externalRef}`);
  }

  return NextResponse.json({ ok: true });
}
