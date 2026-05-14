import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { MobileTopbar } from "@/components/mobile/topbar";
import { DocumentDownloadButton } from "@/components/documents/document-download-button";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "My documents" };
export const dynamic = "force-dynamic";

interface DocRow {
  id: string;
  kind: string;
  file_name: string;
  file_size: number | null;
  notes: string | null;
  created_at: string;
}

function formatBytes(b: number | null): string {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

const KIND_TONE: Record<string, string> = {
  contract: "bg-emerald-100 text-emerald-800",
  id:       "bg-sky-100 text-sky-800",
  receipt:  "bg-violet-100 text-violet-800",
  invoice:  "bg-rose-100 text-rose-800",
  photo:    "bg-amber-100 text-amber-800",
  other:    "bg-slate-100 text-slate-700",
};

export default async function MobileDocumentsPage() {
  const ctx = await getResidentContext();
  const { t } = await getT();
  const supabase = await createClient();

  let docs: DocRow[] = [];
  if (ctx.resident_id) {
    const { data, error } = await supabase
      .from("documents")
      .select("id, kind, file_name, file_size, notes, created_at")
      .eq("entity_type", "resident")
      .eq("entity_id", ctx.resident_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("[m/documents] failed:", error.message);
    } else {
      docs = (data ?? []) as unknown as DocRow[];
    }
  }

  return (
    <div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <MobileTopbar title={(t as any)("nav.documents") || "My documents"} userId={ctx.user_id} unread={0} showBack />
      <div className="p-4">
        {docs.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              No documents yet. Your compound manager will upload your contract, ID copies, and receipts here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li key={d.id} className="rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="truncate text-sm font-medium">{d.file_name}</p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] capitalize ${KIND_TONE[d.kind] ?? KIND_TONE.other}`}>
                        {d.kind}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{formatBytes(d.file_size)}</span>
                      <span className="text-[10px] text-muted-foreground">· {formatDate(d.created_at)}</span>
                    </div>
                    {d.notes && <p className="mt-1 text-[11px] text-muted-foreground">{d.notes}</p>}
                  </div>
                  <DocumentDownloadButton docId={d.id} fileName={d.file_name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
