import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchBar } from "@/components/shared/search-bar";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { DocumentDownloadButton } from "@/components/documents/document-download-button";
import { listAllDocuments } from "@/lib/api/documents";
import { formatDate } from "@/lib/utils";
import { requireCapability } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Documents" };
export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

function formatBytes(b: number | null): string {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

const KIND_TONE: Record<string, string> = {
  contract:   "bg-emerald-100 text-emerald-800",
  id:         "bg-sky-100 text-sky-800",
  receipt:    "bg-violet-100 text-violet-800",
  invoice:    "bg-rose-100 text-rose-800",
  photo:      "bg-amber-100 text-amber-800",
  other:      "bg-slate-100 text-slate-700",
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; entity_type?: string; kind?: string; page?: string }>;
}) {
  await requireCapability("compound:read");
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { data, total } = await listAllDocuments({
    search: sp.q,
    entityType: sp.entity_type,
    kind: sp.kind,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        title="Documents"
        description="All uploaded files across residents, units, contracts, and tickets. Filter, search, and download."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-1"><SearchBar placeholder="Search file name…" /></div>
        <FilterSelect paramName="entity_type" placeholder="attached to"
          options={[
            { value: "resident", label: "Resident" },
            { value: "unit",     label: "Unit" },
            { value: "contract", label: "Contract" },
            { value: "ticket",   label: "Ticket" },
            { value: "compound", label: "Compound" },
          ]} />
        <FilterSelect paramName="kind" placeholder="kind"
          options={[
            { value: "contract", label: "Contract" },
            { value: "id",       label: "ID / passport" },
            { value: "receipt",  label: "Receipt" },
            { value: "invoice",  label: "Invoice" },
            { value: "photo",    label: "Photo" },
            { value: "other",    label: "Other" },
          ]} />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload documents from a resident's profile or any compound entity."
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">File</th>
                <th className="hidden px-3 py-2 text-left md:table-cell">Kind</th>
                <th className="hidden px-3 py-2 text-left md:table-cell">Attached to</th>
                <th className="hidden px-3 py-2 text-left lg:table-cell">Size</th>
                <th className="hidden px-3 py-2 text-left lg:table-cell">Uploaded</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{d.file_name}</p>
                        {d.notes && <p className="truncate text-[10px] text-muted-foreground">{d.notes}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 md:table-cell">
                    <span className={`inline-block rounded px-2 py-0.5 text-[10px] capitalize ${KIND_TONE[d.kind] ?? KIND_TONE.other}`}>
                      {d.kind}
                    </span>
                  </td>
                  <td className="hidden px-3 py-2 text-xs capitalize text-muted-foreground md:table-cell">
                    {d.entity_type}
                  </td>
                  <td className="hidden px-3 py-2 text-xs text-muted-foreground lg:table-cell">
                    {formatBytes(d.file_size)}
                  </td>
                  <td className="hidden px-3 py-2 text-xs text-muted-foreground lg:table-cell">
                    {formatDate(d.created_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <DocumentDownloadButton docId={d.id} fileName={d.file_name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t p-3">
            <Pagination total={total} pageSize={PAGE_SIZE} page={page} />
          </div>
        </Card>
      )}
    </div>
  );
}
