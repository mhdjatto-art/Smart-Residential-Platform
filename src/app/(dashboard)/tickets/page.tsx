import Link from "next/link";
import { Plus, Tag } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchBar } from "@/components/shared/search-bar";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { listTicketsPaged } from "@/lib/api/tickets";
import { TICKET_CATEGORIES } from "@/lib/validations/operations";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; priority?: string; category?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { data, total } = await listTicketsPaged({
    search: sp.q,
    status: sp.status,
    priority: sp.priority,
    category: sp.category,
    page,
    pageSize: PAGE_SIZE,
  });
  const { t } = await getT();

  return (
    <div>
      <PageHeader
        titleKey="headers.tickets_title"
        descKey="headers.tickets_desc"
        actions={
          <Button asChild>
            <Link href="/tickets/new"><Plus className="h-4 w-4" />{t("actions.new_ticket")}</Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2"><SearchBar placeholder={t("ops.tickets_search_ph")} /></div>
        <FilterSelect
          paramName="status"
          placeholder={t("filters.status_placeholder")}
          options={[
            { value: "open", label: t("ops.tickets_status_open") },
            { value: "assigned", label: t("ops.tickets_status_assigned") },
            { value: "in_progress", label: t("ops.tickets_status_in_progress") },
            { value: "pending", label: t("ops.tickets_status_pending") },
            { value: "resolved", label: t("ops.tickets_status_resolved") },
            { value: "closed", label: t("ops.tickets_status_closed") },
          ]}
        />
        <FilterSelect
          paramName="priority"
          placeholder={t("ops.tickets_filter_priority")}
          options={[
            { value: "low", label: t("ops.tickets_priority_low") },
            { value: "medium", label: t("ops.tickets_priority_medium") },
            { value: "high", label: t("ops.tickets_priority_high") },
            { value: "urgent", label: t("ops.tickets_priority_urgent") },
          ]}
        />
      </div>

      <div className="mb-4">
        <FilterSelect
          paramName="category"
          placeholder={t("ops.tickets_filter_category")}
          options={TICKET_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Tag}
          title={t("ops.tickets_no_results_title")}
          description={t("ops.tickets_no_results_desc")}
          action={<Button asChild><Link href="/tickets/new">{t("ops.tickets_open_btn")}</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tables.ticket_number")}</TableHead>
                <TableHead>{t("tables.subject")}</TableHead>
                <TableHead>{t("ops.ticket_category")}</TableHead>
                <TableHead>{t("tables.priority")}</TableHead>
                <TableHead>{t("tables.status")}</TableHead>
                <TableHead>{t("ops.tickets_sla")}</TableHead>
                <TableHead className="text-right">{t("ops.tickets_opened")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((tt) => (
                <TableRow key={tt.id}>
                  <TableCell>
                    <Link href={`/tickets/${tt.id}`} className="font-mono font-medium hover:underline">
                      {tt.ticket_number}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{tt.subject}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{tt.category}</TableCell>
                  <TableCell><PriorityBadge priority={tt.priority} /></TableCell>
                  <TableCell><StatusBadge status={tt.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(tt.sla_due_date)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(tt.opened_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination total={total} pageSize={PAGE_SIZE} page={page} />
        </Card>
      )}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    high: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    urgent: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colors[priority] ?? colors.medium}`}>
      {priority}
    </span>
  );
}
