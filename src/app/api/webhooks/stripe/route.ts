/**
 * POST /api/webhooks/stripe
 * ─────────────────────────
 * Receives Stripe webhook events. We care about:
 *   - checkout.session.completed   → checkout finished, mark bill paid
 *   - payment_intent.succeeded     → fallback if checkout event isn't sent
 *
 * Security:
 *   - HMAC-SHA256 signature verification using STRIPE_WEBHOOK_SECRET
 *   - 5-minute tolerance window
 *   - Idempotent: re-receiving the same event won't double-pay (the SQL
 *     function checks paid_amount + total_amount and refuses overpay)
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature, type StripeEvent } from "@/lib/payments/stripe";
import { sendPaymentReceiptEmail } from "@/lib/email/notify";
import { notifyPaymentReceived } from "@/lib/notifications/bill-events";
import { enforceRateLimit } from "@/lib/rate-limit";
import { reportEvent } from "@/lib/observability/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Generous limit — Stripe legitimately bursts during retries — but stops
  // brute force on the signature secret from a single IP.
  const limited = enforceRateLimit(req, "stripe-webhook", 120, 60_000);
  if (limited) return limited;

  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  if (!verifyWebhookSignature(body, sig)) {
    reportEvent("Stripe webhook signature invalid (possible attack or rotated secret)", {
      module: "stripe-webhook",
      severity: "critical",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(body) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  console.log("[stripe-webhook] event:", event.type, event.id);

  if (event.type === "checkout.session.completed") {
    return handleCheckoutCompleted(event);
  }
  if (event.type === "payment_intent.succeeded") {
    return handlePaymentIntentSucceeded(event);
  }

  // Unhandled — ack to stop retries
  return NextResponse.json({ ok: true, ignored: event.type });
}

async function handleCheckoutCompleted(event: StripeEvent): Promise<Response> {
  const session = event.data.object as {
    id: string;
    client_reference_id?: string;
    metadata?: { bill_id?: string; installment_id?: string; contract_id?: string; kind?: string };
    amount_total?: number;
    currency?: string;
    payment_status?: string;
  };

  if (session.payment_status !== "paid") {
    console.log("[stripe-webhook] checkout not paid, status:", session.payment_status);
    return NextResponse.json({ ok: true, ignored: "not paid" });
  }

  const ZERO_DECIMAL = new Set(["bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf"]);
  const ccy = (session.currency ?? "usd").toLowerCase();
  const cents = session.amount_total ?? 0;
  const amount = ZERO_DECIMAL.has(ccy) ? cents : cents / 100;

  // Phase 20: route to installment/rent handler when metadata.kind = 'installment'
  if (session.metadata?.kind === "installment" && session.metadata.installment_id && session.metadata.contract_id) {
    return recordInstallmentPayment(
      session.metadata.contract_id,
      amount,
      session.id,
      "checkout.session.completed",
    );
  }

  const billId = session.metadata?.bill_id ?? session.client_reference_id;
  if (!billId) {
    console.error("[stripe-webhook] missing bill_id in checkout.session.completed");
    return NextResponse.json({ ok: true, ignored: "missing bill_id" });
  }

  return recordPayment(billId, amount, session.id, "checkout.session.completed");
}

async function recordInstallmentPayment(contractId: string, amount: number, ref: string, source: string): Promise<Response> {
  if (amount <= 0) return NextResponse.json({ ok: true, ignored: "zero amount" });
  const admin = createAdminClient();

  // Idempotency — check if a payment with this Stripe ref already exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin as any)
    .from("payments")
    .select("id")
    .eq("external_reference", ref)
    .maybeSingle();
  if (existing?.id) {
    console.log("[stripe-webhook] installment payment already recorded:", ref);
    return NextResponse.json({ ok: true, ignored: "duplicate" });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).rpc("record_payment", {
    p_contract_id:    contractId,
    p_amount:         amount,
    p_payment_method: "online_payment",
    p_payment_date:   new Date().toISOString().slice(0, 10),
    p_external_ref:   ref,
    p_notes:          `Stripe ${source}`,
  });
  if (error) {
    console.error("[stripe-webhook] record_payment failed:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  console.log("[stripe-webhook] recorded installment payment:", contractId, amount, ref);
  return NextResponse.json({ ok: true, contract_id: contractId, amount });
}

async function handlePaymentIntentSucceeded(event: StripeEvent): Promise<Response> {
  const pi = event.data.object as {
    id: string;
    metadata?: { bill_id?: string };
    amount_received?: number;
    currency?: string;
  };
  const billId = pi.metadata?.bill_id;
  if (!billId) {
    return NextResponse.json({ ok: true, ignored: "no bill_id in payment_intent" });
  }
  const ZERO_DECIMAL = new Set(["bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf"]);
  const ccy = (pi.currency ?? "usd").toLowerCase();
  const cents = pi.amount_received ?? 0;
  const amount = ZERO_DECIMAL.has(ccy) ? cents : cents / 100;

  return recordPayment(billId, amount, pi.id, "payment_intent.succeeded");
}

async function recordPayment(billId: string, amount: number, ref: string, source: string): Promise<Response> {
  if (amount <= 0) {
    return NextResponse.json({ ok: true, ignored: "zero amount" });
  }

  const admin = createAdminClient();

  // Idempotency: skip if we've already recorded a payment with this Stripe ref
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bill } = await (admin as any)
    .from("utility_bills")
    .select("metadata, status")
    .eq("id", billId)
    .maybeSingle();
  const md = ((bill?.metadata ?? {}) as Record<string, unknown>);
  const lastPayment = (md.last_payment ?? null) as { reference?: string } | null;
  if (lastPayment?.reference === ref) {
    console.log("[stripe-webhook] already processed:", ref);
    return NextResponse.json({ ok: true, ignored: "duplicate" });
  }
  if (bill?.status === "paid") {
    console.log("[stripe-webhook] bill already paid:", billId);
    return NextResponse.json({ ok: true, ignored: "already paid" });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).rpc("record_utility_bill_payment", {
    p_bill_id:   billId,
    p_amount:    amount,
    p_method:    "online_payment",
    p_reference: ref,
    p_notes:     `Stripe ${source}`,
  });

  if (error) {
    console.error("[stripe-webhook] record_utility_bill_payment failed:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  console.log("[stripe-webhook] recorded payment:", billId, amount, ref);

  // Fire-and-forget receipt email + in-app notification (best-effort)
  sendPaymentReceiptEmail(billId, amount, "online_payment", ref).catch((e) => {
    console.error("[stripe-webhook] receipt email failed:", e instanceof Error ? e.message : String(e));
  });
  notifyPaymentReceived(billId, amount).catch((e) => {
    console.error("[stripe-webhook] in-app notification failed:", e instanceof Error ? e.message : String(e));
  });

  return NextResponse.json({ ok: true, bill_id: billId, amount });
}
