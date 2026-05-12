"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { announcementSchema, type AnnouncementInput } from "@/lib/validations/operations";

export interface AnnouncementRow {
  id: string;
  organization_id: string;
  compound_id: string | null;
  kind: string;
  title: string;
  body: string;
  published_at: string;
  expires_at: string | null;
  is_pinned: boolean;
  target_audience: string;
  created_at: string;
}

export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AnnouncementRow[];
}

export async function createAnnouncement(orgId: string, input: AnnouncementInput): Promise<AnnouncementRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const parsed = announcementSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      organization_id: orgId,
      compound_id: parsed.compound_id ?? null,
      kind: parsed.kind,
      title: parsed.title,
      body: parsed.body,
      target_audience: parsed.target_audience,
      expires_at: parsed.expires_at ? new Date(parsed.expires_at).toISOString() : null,
      is_pinned: parsed.is_pinned,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/announcements");
  return data as unknown as AnnouncementRow;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/announcements");
}
