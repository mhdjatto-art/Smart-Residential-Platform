"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";

export interface ReminderRow {
  id: string;
  organization_id: string;
  compound_id: string;
  contract_id: string;
  installment_id: string | null;
  resident_id: string;
  kind: string;
  channel: string;
  status: string;
  scheduled_for: string;
  sent_at: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

interface ListOpts {
  status?: string;
  kind?: string;
  page?: number;
  pageSize?: number;
}

export async function listReminders(opts: ListOpts = {}): Promise<{ data: ReminderRow[]; total: number }> {
  await requireUser();
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 50);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("payment_reminders")
    .select("*", { count: "exact" })
    .order("scheduled_for", { ascending: false })
    .range(from, to);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (opts.kind && opts.kind !== "all") q = q.eq("kind", opts.kind as any);

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return { data: (data ?? []) as unknown as ReminderRow[], total: count ?? 0 };
}

/** Run the reminder generator. Returns the number of new reminders created. */
export async function generateReminders(upcomingDays = 7): Promise<number> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_payment_reminders", { p_upcoming_days: upcomingDays });
  if (error) throw new Error(error.message);
  revalidatePath("/reminders");
  return Number(data) || 0;
}

export async function dismissReminder(id: string): Promise<void> {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("dismiss_reminder", { p_reminder_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/reminders");
}
