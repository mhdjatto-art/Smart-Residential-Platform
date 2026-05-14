"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";

export interface DocumentRow {
  id: string;
  organization_id: string;
  compound_id: string | null;
  entity_type: string;
  entity_id: string;
  kind: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
}

export async function listDocuments(opts: {
  entityType: string;
  entityId: string;
}): Promise<DocumentRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("entity_type", opts.entityType)
    .eq("entity_id", opts.entityId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DocumentRow[];
}

export interface AllDocumentsOpts {
  entityType?: string;
  kind?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listAllDocuments(opts: AllDocumentsOpts = {}): Promise<{ data: DocumentRow[]; total: number }> {
  await requireUser();
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 25);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from("documents").select("*", { count: "exact" })
    .order("created_at", { ascending: false }).range(from, to);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (opts.entityType) q = q.eq("entity_type", opts.entityType as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (opts.kind)       q = q.eq("kind", opts.kind as any);
  if (opts.search?.trim()) q = q.ilike("file_name", `%${opts.search.trim()}%`);

  const { data, count, error } = await q;
  if (error) {
    console.error("[listAllDocuments] failed:", error.message);
    return { data: [], total: 0 };
  }
  return { data: (data ?? []) as unknown as DocumentRow[], total: count ?? 0 };
}

/**
 * Server action that uploads a file to Supabase Storage AND inserts a row
 * into public.documents in a single round-trip from the client.
 *
 * Called from a Client Component using FormData.
 */
export async function uploadDocument(formData: FormData): Promise<DocumentRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const supabase = await createClient();

  const file = formData.get("file");
  const entityType = String(formData.get("entity_type") ?? "");
  const entityId = String(formData.get("entity_id") ?? "");
  const kind = String(formData.get("kind") ?? "other");
  const notes = (formData.get("notes") as string | null) || null;
  const expires = (formData.get("expires_at") as string | null) || null;

  if (!(file instanceof File)) throw new Error("File is required");
  if (!entityType || !entityId) throw new Error("entity_type and entity_id are required");

  // Look up the organization/compound for the parent entity so the path
  // contains tenant scope.
  let organizationId: string;
  let compoundId: string | null = null;

  if (entityType === "resident") {
    const { data, error } = await supabase
      .from("residents").select("organization_id, compound_id").eq("id", entityId).single();
    if (error || !data) throw new Error("Resident not found");
    const r = data as { organization_id: string; compound_id: string };
    organizationId = r.organization_id;
    compoundId = r.compound_id;
  } else if (entityType === "unit") {
    const { data, error } = await supabase
      .from("units").select("organization_id, compound_id").eq("id", entityId).single();
    if (error || !data) throw new Error("Unit not found");
    const u = data as { organization_id: string; compound_id: string };
    organizationId = u.organization_id;
    compoundId = u.compound_id;
  } else if (entityType === "compound") {
    const { data, error } = await supabase
      .from("compounds").select("organization_id").eq("id", entityId).single();
    if (error || !data) throw new Error("Compound not found");
    organizationId = (data as { organization_id: string }).organization_id;
    compoundId = entityId;
  } else {
    throw new Error(`Unsupported entity_type: ${entityType}`);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${organizationId}/${entityType}/${entityId}/${Date.now()}_${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(storagePath, file, { upsert: false, contentType: file.type });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  const { data, error } = await supabase
    .from("documents")
    .insert({
      organization_id: organizationId,
      compound_id: compoundId,
      entity_type: entityType,
      entity_id: entityId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- enum narrowing
      kind: kind as any,
      storage_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      expires_at: expires,
      notes,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from("documents").remove([storagePath]);
    throw new Error(error.message);
  }

  revalidatePath(`/${entityType}s/${entityId}`);
  return data as unknown as DocumentRow;
}

export async function deleteDocument(id: string): Promise<void> {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const supabase = await createClient();

  const { data: doc, error: gErr } = await supabase
    .from("documents")
    .select("storage_path, entity_type, entity_id")
    .eq("id", id)
    .single();
  if (gErr || !doc) throw new Error("Document not found");
  const d = doc as { storage_path: string; entity_type: string; entity_id: string };

  await supabase.storage.from("documents").remove([d.storage_path]);
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/${d.entity_type}s/${d.entity_id}`);
}

/** Returns a 60-minute signed URL for downloading/previewing a document. */
export async function getDocumentSignedUrl(id: string): Promise<string> {
  await requireUser();
  const supabase = await createClient();
  const { data: doc, error: gErr } = await supabase
    .from("documents").select("storage_path").eq("id", id).single();
  if (gErr || !doc) throw new Error("Document not found");

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl((doc as { storage_path: string }).storage_path, 3600);
  if (error || !data) throw new Error(error?.message ?? "Could not sign URL");
  return data.signedUrl;
}
