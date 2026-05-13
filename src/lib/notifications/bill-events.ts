/**
 * Helpers that translate billing events into in-app notifications.
 *
 * Each function resolves the recipient (the bill's resident, or the unit's
 * resident if the bill is unit-level) and creates a `notifications` row.
 * Service-role client — works from webhooks, cron, and server actions.
 *
 * Best-effort: failures are logged but never thrown to the caller.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/api/notifications";
import { sendPushToUser } from "@/lib/push/send";

async function resolveRecipientUserId(billId: string): Promise<{
  user_id: string | null;
  organization_id: string;
  bill_number: string;
  utility_type: string;
  total_amount: number;
  penalty_amount: number;
  paid_amount: number;
  currency: string;
  due_date: string;
  resident_id: string | null;
  unit_id: string | null;
} | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("utility_bills")
    .select("organization_id, bill_number, utility_type, total_amount, penalty_amount, paid_amount, currency, due_date, resident_id, unit_id")
    .eq("id", billId)
    .maybeSingle();
  if (!data) return null;
  const b = data as {
    organization_id: string; bill_number: string; utility_type: string;
    total_amount: number; penalty_amount: number; paid_amount: number;
    currency: string; due_date: string;
    resident_id: string | null; unit_id: string | null;
  };

  let userId: string | null = null;
  if (b.resident_id) {
    const { data: r } = await admin.from("residents").select("user_id").eq("id", b.resident_id).maybeSingle();
    userId = (r as { user_id?: string | null } | null)?.user_id ?? null;
  } else if (b.unit_id) {
    const { data: r } = await admin
      .from("residents")
      .select("user_id")
      .eq("unit_id", b.unit_id)
      .eq("status", "active")
      .not("user_id", "is", null)
      .limit(1)
      .maybeSingle();
    userId = (r as { user_id?: string | null } | null)?.user_id ?? null;
  }

  return { user_id: userId, ...b };
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

// ─── Payment received ────────────────────────────────────────────────────────

export async function notifyPaymentReceived(billId: string, amount: number): Promise<void> {
  const ctx = await resolveRecipientUserId(billId);
  if (!ctx?.user_id) return;
  const title = `Payment received · ${formatCurrency(amount, ctx.currency)}`;
  const body = `Your ${ctx.utility_type} bill ${ctx.bill_number} has been marked paid.`;
  const href = `/m/payments/${billId}/receipt`;
  await Promise.all([
    createNotification({
      user_id: ctx.user_id,
      organization_id: ctx.organization_id,
      kind: "payment_received",
      title, body,
      entity_type: "utility_bill",
      entity_id: billId,
      href,
    }),
    sendPushToUser(ctx.user_id, { title, body, url: href, tag: `payment-${billId}` }),
  ]);
}

// ─── New bill issued ─────────────────────────────────────────────────────────

export async function notifyNewBill(billId: string): Promise<void> {
  const ctx = await resolveRecipientUserId(billId);
  if (!ctx?.user_id) return;
  const owed = Math.max(0, ctx.total_amount + ctx.penalty_amount - ctx.paid_amount);
  const title = `New ${ctx.utility_type} bill · ${formatCurrency(owed, ctx.currency)}`;
  const body = `Bill ${ctx.bill_number} is due on ${ctx.due_date}. Tap to view or pay.`;
  await Promise.all([
    createNotification({
      user_id: ctx.user_id,
      organization_id: ctx.organization_id,
      kind: "new_bill",
      title, body,
      entity_type: "utility_bill",
      entity_id: billId,
      href: "/m/payments",
    }),
    sendPushToUser(ctx.user_id, { title, body, url: "/m/payments", tag: `bill-${billId}` }),
  ]);
}

// ─── Penalty applied ─────────────────────────────────────────────────────────

export async function notifyPenaltyApplied(billId: string, penaltyAmount: number): Promise<void> {
  const ctx = await resolveRecipientUserId(billId);
  if (!ctx?.user_id) return;
  const title = `Late penalty added · ${formatCurrency(penaltyAmount, ctx.currency)}`;
  const body = `Bill ${ctx.bill_number} is overdue. Pay now to stop further penalties.`;
  await Promise.all([
    createNotification({
      user_id: ctx.user_id,
      organization_id: ctx.organization_id,
      kind: "penalty_applied",
      title, body,
      entity_type: "utility_bill",
      entity_id: billId,
      href: "/m/payments",
    }),
    sendPushToUser(ctx.user_id, { title, body, url: "/m/payments", tag: `penalty-${billId}` }),
  ]);
}
