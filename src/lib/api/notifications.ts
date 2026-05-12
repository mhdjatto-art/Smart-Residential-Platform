"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";

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
