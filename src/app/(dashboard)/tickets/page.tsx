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

  return (
    <div>
      <PageHeader
        title="Tickets"
        description="Resident complaints, maintenance requests, and operational issues."
        actions={
          <Button asChild>
            <Link href="/tickets/new"><Plus className="h-4 w-4" />New ticket</Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2"><SearchBar placeholder="Search subject, description, ticket #…" /></div>
        <FilterSelect
          paramName="status"
          placeholder="status"
          options={[
            { value: "open", label: "Open" },
            { value: "assigned", label: "Assigned" },
            { value: "in_progress", label: "In progress" },
            { value: "pending", label: "Pending" },
            { value: "resolved", label: "Resolved" },
            { value: "closed", label: "Closed" },
          ]}
        />
        <FilterSelect
          paramName="priority"
          placeholder="priority"
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "urgent", label: "Urgent" },
          ]}
        />
      </div>

      <div className="mb-4">
        <FilterSelect
          paramName="category"
          placeholder="category"
          options={TICKET_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No tickets found"
          description="When residents report issues, they'll appear here."
          action={<Button asChild><Link href="/tickets/new">Open ticket</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket #</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead className="text-right">Opened</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link href={`/tickets/${t.id}`} className="font-mono font-medium hover:underline">
                      {t.ticket_number}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{t.subject}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{t.category}</TableCell>
                  <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(t.sla_due_date)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(t.opened_at)}</TableCell>
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
