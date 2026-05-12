import Link from "next/link";
import { Plus, Wrench } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { listMaintenanceJobs } from "@/lib/api/maintenance";
import { formatDate, formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { data, total } = await listMaintenanceJobs({
    status: sp.status,
    jobType: sp.type,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="Work orders, scheduled jobs, and technician assignments."
        actions={
          <Button asChild>
            <Link href="/maintenance/new"><Plus className="h-4 w-4" />New job</Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FilterSelect
          paramName="status"
          placeholder="status"
          options={[
            { value: "scheduled", label: "Scheduled" },
            { value: "in_progress", label: "In progress" },
            { value: "on_hold", label: "On hold" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        <FilterSelect
          paramName="type"
          placeholder="type"
          options={[
            { value: "preventive", label: "Preventive" },
            { value: "corrective", label: "Corrective" },
            { value: "emergency", label: "Emergency" },
          ]}
        />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No maintenance jobs"
          description="Create work orders manually or from tickets."
          action={<Button asChild><Link href="/maintenance/new">New job</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((j) => (
                <TableRow key={j.id}>
                  <TableCell>
                    <Link href={`/maintenance/${j.id}`} className="font-mono hover:underline">{j.job_number}</Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{j.title}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{j.job_type}</TableCell>
                  <TableCell><StatusBadge status={j.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(j.scheduled_for)}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.cost !== null ? formatCurrency(j.cost, { currency: j.cost_currency ?? "USD" }) : "—"}</TableCell>
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
