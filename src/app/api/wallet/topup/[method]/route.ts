/**
 * Unified top-up checkout endpoint.
 *
 *   POST /api/wallet/topup/{method}
 *
 * Request body:
 *   {
 *     "walletId": "uuid",
 *     "amount":   25000,
 *     "currency": "iqd"     // optional, defaults to the wallet's currency
 *   }
 *
 * Response (success):
 *   {
 *     "checkoutUrl": "https://...",
 *     "gatewayRef":  "...",
 *     "externalRef": "wallet:...:t:...:...",
 *     "deepLink":    "nass://..."   // optional
 *   }
 *
 * The route:
 *   1. Authenticates the caller (resident or staff).
 *   2. Verifies the wallet belongs to the same organization the user is in.
 *   3. Builds a deterministic `externalRef` for this attempt.
 *   4. Calls the right adapter's `createCheckout()`.
 *   5. Stores a `pending` row so the manager UI can see in-flight tops-ups
 *      (best-effort — if the row insert fails we still return the URL).
 *
 * The webhook (see /api/webhooks/{provider}) will later call the
 * `topup_wallet` RPC with `p_external_ref = externalRef`. That RPC is
 * idempotent on the external reference, so retries are safe.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getGateway, isKnownGateway } from "@/lib/payments/registry";
import { buildExternalRef } from "@/lib/payments/types";
import { logger } from "@/lib/logger";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bonyan.app";

// We don't want this route cached.
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ method: string }> },
) {
  // 1. Rate-limit per IP first (30 attempts / 5 minutes).
  const limited = enforceRateLimit(request, "wallet-topup", 30, 5 * 60_000);
  if (limited) return limited;

  // 2. Resolve method + adapter.
  const { method } = await params;
  if (!isKnownGateway(method)) {
    return NextResponse.json({ error: `Unsupported payment method: ${method}` }, { status: 400 });
  }
  const gateway = getGateway(method);
  if (!gateway.isConfigured()) {
    return NextResponse.json(
      { error: `${method} is not configured on this environment` },
      { status: 503 },
    );
  }

  // 3. Auth.
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 4. Parse body.
  let body: { walletId?: string; amount?: number; currency?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { walletId, amount } = body;
  if (!walletId || typeof walletId !== "string") {
    return NextResponse.json({ error: "walletId is required" }, { status: 400 });
  }
  if (!amount || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
  }
  if (amount < 1000) {
    return NextResponse.json({ error: "Minimum top-up is 1,000 IQD" }, { status: 400 });
  }

  // 5. Fetch the wallet to validate ownership + currency.
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: wallet, error: wErr } = await (supabase as any)
    .from("utility_wallets")
    .select("id, organization_id, resident_id, utility_type, currency, balance, status")
    .eq("id", walletId)
    .maybeSingle();
  if (wErr || !wallet) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }
  if (wallet.status !== "active") {
    return NextResponse.json({ error: "Wallet is not active" }, { status: 400 });
  }

  // Authorisation: the wallet must belong to the same organization the user
  // is in. (Residents top up their own wallets; staff can top up any wallet
  // in their org.)
  if (!user.isSuperAdmin && !user.organizationIds.includes(wallet.organization_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 6. Build externalRef and ask the gateway for a checkout URL.
  const externalRef = buildExternalRef(walletId);
  const currency = (body.currency ?? wallet.currency ?? "iqd").toLowerCase();
  const utilityType = String(wallet.utility_type ?? "wallet");

  const description = `SRP wallet top-up · ${utilityType}`;

  let checkout;
  try {
    checkout = await gateway.createCheckout({
      externalRef,
      walletId,
      amount,
      currency,
      description,
      customerEmail: user.email ?? undefined,
      successUrl:    `${APP_URL}/m/wallet?topup=success&ref=${encodeURIComponent(externalRef)}`,
      cancelUrl:     `${APP_URL}/m/wallet?topup=cancel&ref=${encodeURIComponent(externalRef)}`,
      webhookUrl:    `${APP_URL}/api/webhooks/${method}`,
      metadata: {
        wallet_id:    walletId,
        external_ref: externalRef,
        utility_type: utilityType,
        method,
      },
    });
  } catch (e) {
    logger.error("wallet-topup", `gateway error (${method})`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gateway error" },
      { status: 502 },
    );
  }

  // 7. Best-effort: record a pending topup row so admins can see in-flight
  //    attempts. We do NOT credit the wallet yet — that happens at webhook
  //    time via the `topup_wallet` RPC.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("wallet_topups").insert({
      wallet_id:          walletId,
      amount,
      currency,
      balance_before:     wallet.balance,
      balance_after:      wallet.balance,    // unchanged until settled
      topup_method:       method,
      external_reference: externalRef,
      payment_id:         checkout.gatewayRef,
      notes:              `Pending — checkout created via ${method}`,
    });
  } catch (e) {
    // Don't fail the request if the audit insert fails — the webhook will
    // still credit correctly because it uses the external_reference key.
    logger.warn("wallet-topup", `failed to record pending row (${method})`, e);
  }

  return NextResponse.json({
    checkoutUrl: checkout.checkoutUrl,
    gatewayRef:  checkout.gatewayRef,
    externalRef,
    deepLink:    checkout.deepLink,
  });
}
