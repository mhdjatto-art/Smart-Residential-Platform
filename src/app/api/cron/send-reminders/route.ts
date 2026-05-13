/**
 * GET /api/cron/send-reminders
 * ───────────────────────────
 * Daily reminder job — sends bill-reminder emails for bills due in 3 days,
 * 1 day, or today. Skips already-paid bills. Auth via CRON_SECRET header.
 *
 * Schedule daily in vercel.json:
 *   { "path": "/api/cron/send-reminders", "schedule": "0 9 * * *" }
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBillReminderEmail } from "@/lib/email/notify";
import { requireCronAuth } from "@/lib/cron/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireCronAuth(request, "send-reminders");
  if (denied) return denied;

  const admin = createAdminClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Bills due in 3 days, 1 day, or today
  const targets = [0, 1, 3].map((d) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + d);
    return dt.toISOString().slice(0, 10);
  });

  const { data, error } = await admin
    .from("utility_bills")
    .select("id, due_date")
    .in("status", ["issued", "partial", "overdue"])
    .in("due_date", targets);

  if (error) {
    console.error("[send-reminders] query failed:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const bills = (data ?? []) as Array<{ id: string; due_date: string }>;
  console.log(`[send-reminders] found ${bills.length} bills due on ${targets.join(", ")}`);

  let sent = 0;
  let errors = 0;
  for (const b of bills) {
    try {
      await sendBillReminderEmail(b.id);
      sent++;
    } catch (e) {
      console.error("[send-reminders] failed for", b.id, ":", e instanceof Error ? e.message : String(e));
      errors++;
    }
  }

  return NextResponse.json({ ok: true, found: bills.length, sent, errors });
}
