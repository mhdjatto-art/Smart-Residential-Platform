/**
 * High-level notification helpers — fetch what each template needs and send.
 *
 * Uses the service-role admin client so they work from anywhere (webhook,
 * cron, server action). All functions are best-effort: failures are logged
 * but never thrown to the caller.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/email/resend";
import {
  paymentReceiptEmail,
  billReminderEmail,
  penaltyNoticeEmail,
} from "@/lib/email/templates";
import { logger } from "@/lib/logger";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000";
}

interface BillWithJoins {
  id: string;
  bill_number: string;
  utility_type: string;
  total_amount: number;
  penalty_amount: number;
  paid_amount: number;
  due_date: string;
  currency: string;
  status: string;
  paid_at: string | null;
  organization_id: string;
  resident_id: string | null;
  unit_id: string | null;
}

async function fetchBillWithEmail(billId: string): Promise<{
  bill: BillWithJoins;
  recipient_email: string | null;
  recipient_name: string;
  organization_name: string;
} | null> {
  const admin = createAdminClient();
  const { data: bill } = await admin
    .from("utility_bills")
    .select("id, bill_number, utility_type, total_amount, penalty_amount, paid_amount, due_date, currency, status, paid_at, organization_id, resident_id, unit_id")
    .eq("id", billId)
    .maybeSingle();
  if (!bill) return null;
  const b = bill as BillWithJoins;

  // Find the recipient: resident on the bill, or any resident of the unit
  let email: string | null = null;
  let name = "Resident";
  if (b.resident_id) {
    const { data: r } = await admin
      .from("residents")
      .select("first_name, last_name, email")
      .eq("id", b.resident_id)
      .maybeSingle();
    if (r) {
      const rr = r as { first_name: string | null; last_name: string | null; email: string | null };
      email = rr.email;
      name = [rr.first_name, rr.last_name].filter(Boolean).join(" ") || name;
    }
  } else if (b.unit_id) {
    const { data: r } = await admin
      .from("residents")
      .select("first_name, last_name, email")
      .eq("unit_id", b.unit_id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (r) {
      const rr = r as { first_name: string | null; last_name: string | null; email: string | null };
      email = rr.email;
      name = [rr.first_name, rr.last_name].filter(Boolean).join(" ") || name;
    }
  }

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", b.organization_id)
    .maybeSingle();
  const organization_name = (org as { name?: string } | null)?.name ?? "SRP";

  return { bill: b, recipient_email: email, recipient_name: name, organization_name };
}

// ─── Payment receipt ─────────────────────────────────────────────────────────

export async function sendPaymentReceiptEmail(
  billId: string,
  amount: number,
  method: string,
  reference: string,
): Promise<void> {
  if (!isEmailConfigured()) return;

  try {
    const ctx = await fetchBillWithEmail(billId);
    if (!ctx || !ctx.recipient_email) {
      logger.info("email", `receipt skipped — no recipient for bill ${billId}`);
      return;
    }

    const tpl = paymentReceiptEmail({
      recipient_name: ctx.recipient_name,
      organization_name: ctx.organization_name,
      bill_number: ctx.bill.bill_number,
      utility_type: ctx.bill.utility_type,
      amount,
      currency: ctx.bill.currency,
      paid_at: ctx.bill.paid_at ?? new Date().toISOString(),
      method,
      reference,
      receipt_url: `${appUrl()}/m/payments/${billId}/receipt`,
    });

    await sendEmail({
      to: ctx.recipient_email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      tags: [
        { name: "kind", value: "payment_receipt" },
        { name: "bill_id", value: billId },
      ],
    });
  } catch (e) {
    logger.error("email", "sendPaymentReceiptEmail threw", e);
  }
}

// ─── Bill due reminder ───────────────────────────────────────────────────────

export async function sendBillReminderEmail(billId: string): Promise<void> {
  if (!isEmailConfigured()) return;

  try {
    const ctx = await fetchBillWithEmail(billId);
    if (!ctx || !ctx.recipient_email) return;

    const owed = Math.max(0, ctx.bill.total_amount + ctx.bill.penalty_amount - ctx.bill.paid_amount);
    if (owed <= 0) return; // Already paid

    const dueDate = new Date(ctx.bill.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    const days_until_due = Math.round((dueDate.getTime() - today.getTime()) / (24 * 3600 * 1000));

    const tpl = billReminderEmail({
      recipient_name: ctx.recipient_name,
      organization_name: ctx.organization_name,
      bill_number: ctx.bill.bill_number,
      utility_type: ctx.bill.utility_type,
      amount: owed,
      currency: ctx.bill.currency,
      due_date: ctx.bill.due_date,
      days_until_due,
      pay_url: `${appUrl()}/m/payments`,
    });

    await sendEmail({
      to: ctx.recipient_email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      tags: [
        { name: "kind", value: "bill_reminder" },
        { name: "bill_id", value: billId },
      ],
    });
  } catch (e) {
    logger.error("email", "sendBillReminderEmail threw", e);
  }
}

// ─── Penalty notice ──────────────────────────────────────────────────────────

export async function sendPenaltyNoticeEmail(billId: string): Promise<void> {
  if (!isEmailConfigured()) return;

  try {
    const ctx = await fetchBillWithEmail(billId);
    if (!ctx || !ctx.recipient_email) return;
    if (ctx.bill.penalty_amount <= 0) return;

    const today = new Date();
    const due = new Date(ctx.bill.due_date);
    const days_overdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / (24 * 3600 * 1000)));

    const tpl = penaltyNoticeEmail({
      recipient_name: ctx.recipient_name,
      organization_name: ctx.organization_name,
      bill_number: ctx.bill.bill_number,
      utility_type: ctx.bill.utility_type,
      original_amount: ctx.bill.total_amount,
      penalty_amount: ctx.bill.penalty_amount,
      total_amount: ctx.bill.total_amount + ctx.bill.penalty_amount,
      currency: ctx.bill.currency,
      due_date: ctx.bill.due_date,
      days_overdue,
      pay_url: `${appUrl()}/m/payments`,
    });

    await sendEmail({
      to: ctx.recipient_email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      tags: [
        { name: "kind", value: "penalty_notice" },
        { name: "bill_id", value: billId },
      ],
    });
  } catch (e) {
    logger.error("email", "sendPenaltyNoticeEmail threw", e);
  }
}
