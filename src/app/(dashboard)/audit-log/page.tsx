import type { Metadata } from "next";
import { Activity, ChevronRight, History, Plus, Trash2, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect } from "@/components/shared/filter-select";
import { SearchBar } from "@/components/shared/search-bar";
import { Pagination } from "@/components/shared/pagination";
import { listAuditLog, diffKeys } from "@/lib/api/audit";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

const ACTION_TONE: Record<string, string> = {
  insert: "bg-emerald-100 text-emerald-800",
  update: "bg-sky-100 text-sky-800",
  delete: "bg-rose-100 text-rose-800",
};

const ACTION_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  insert: Plus,
  update: Pencil,
  delete: Trash2,
};

const ACTION_LABEL: Record<string, string> = {
  insert: "Created",
  update: "Updated",
  delete: "Deleted",
};

const TABLES = [
  { value: "installment_contracts", label: "Contracts" },
  { value: "payments", label: "Payments" },
  { value: "residents", label: "Residents" },
  { value: "units", label: "Units" },
  { value: "contract_signatures", label: "Signatures" },
  { value: "organization_branding", label: "Branding" },
  { value: "user_roles", label: "User roles" },
  { value: "utility_bills", label: "Utility bills" },
  { value: "documents", label: "Documents" },
  { value: "tickets", label: "Tickets" },
];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; table?: string; action?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { data, total } = await listAuditLog({
    table: sp.table,
    rowId: sp.q,
    action: sp.action as "insert" | "update" | "delete" | undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Immutable record of every change to contracts, payments, residents, units, signatures, and configuration."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-1"><SearchBar placeholder="Filter by row ID (UUID)…" /></div>
        <FilterSelect paramName="table" placeholder="any table" options={TABLES} />
        <FilterSelect paramName="action" placeholder="any action"
          options={[
            { value: "insert", label: "Created" },
            { value: "update", label: "Updated" },
            { value: "delete", label: "Deleted" },
          ]} />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No audit entries yet"
          description="As people use the system, every change to contracts, payments, residents, and configuration will appear here."
        />
      ) : (
        <Card>
          <ul className="divide-y">
            {data.map((r) => {
              const Icon = ACTION_ICON[r.action] ?? History;
              const changedKeys = r.action === "update" ? diffKeys(r.diff) : [];
              const summary = r.action === "update"
                ? changedKeys.length === 0 ? "no fields changed" : `${changedKeys.length} field${changedKeys.length === 1 ? "" : "s"}: ${changedKeys.slice(0, 4).join(", ")}${changedKeys.length > 4 ? "…" : ""}`
                : r.action === "insert" ? "created" : "deleted";
              return (
                <li key={r.id} className="flex items-start gap-3 p-3 hover:bg-muted/40">
                  <div className="mt-0.5 shrink-0">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${ACTION_TONE[r.action] ?? ""}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="muted" className="font-mono text-[10px]">{r.table_name}</Badge>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ACTION_TONE[r.action] ?? ""}`}>
                        {ACTION_LABEL[r.action] ?? r.action}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(r.created_at)} {new Date(r.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">
                      <span className="font-medium">
                        {r.actor_email ?? (r.actor_id ? `${r.actor_id.slice(0, 8)}…` : "system")}
                      </span>
                      <span className="text-muted-foreground"> · {summary}</span>
                    </p>
                    {r.row_id && (
                      <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                        row {r.row_id}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground/50" />
                </li>
              );
            })}
          </ul>
          <div className="border-t p-3">
            <Pagination total={total} pageSize={PAGE_SIZE} page={page} />
          </div>
        </Card>
      )}
    </div>
  );
}
