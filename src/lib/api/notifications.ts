"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

export async function listMyNotifications(unreadOnly = false): Promise<NotificationRow[]> {
  const user = await requireUser();
  const supabase = await createClient();
  let q = supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  if (unreadOnly) q = q.is("read_at", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as NotificationRow[];
}

export async function getUnreadCount(): Promise<number> {
  const user = await requireUser();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markRead(id: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/notifications");
}

export async function markAllRead(): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) throw new Error(error.message);
  revalidatePath("/notifications");
}

// ─── createNotification (system-level — bypasses RLS via service role) ──────

export interface CreateNotificationInput {
  user_id: string;
  organization_id: string;
  kind:
    | "ticket_update"
    | "maintenance_assigned"
    | "booking_status"
    | "visitor_status"
    | "payment_received"
    | "new_bill"
    | "bill_due_soon"
    | "penalty_applied"
    | "announcement"
    | "system";
  title: string;
  body?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  href?: string | null;
}

/**
 * Best-effort notification creation. Uses the service-role client so it
 * works from webhooks/cron without a user session. Never throws — logs and
 * returns null on failure.
 */
export async function createNotification(input: CreateNotificationInput): Promise<string | null> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("notifications")
      .insert({
        user_id: input.user_id,
        organization_id: input.organization_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kind enum mismatch between code and DB
        kind: input.kind as any,
        title: input.title,
        body: input.body ?? null,
        entity_type: input.entity_type ?? null,
        entity_id: input.entity_id ?? null,
        href: input.href ?? null,
      })
      .select("id")
      .single();
    if (error) {
      logger.error("notifications", "createNotification insert failed", error);
      return null;
    }
    return (data as { id: string }).id;
  } catch (e) {
    logger.error("notifications", "createNotification threw", e);
    return null;
  }
}
