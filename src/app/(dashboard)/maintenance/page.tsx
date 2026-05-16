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
import { getT } from "@/lib/i18n/server";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; page?: string }>;
}) {
  await requireCapability("ticket:read");
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { data, total } = await listMaintenanceJobs({
    status: sp.status,
    jobType: sp.type,
    page,
    pageSize: PAGE_SIZE,
  });
  const { t } = await getT();

  return (
    <div>
      <PageHeader
        title={t("ops.maintenance_title")}
        description={t("ops.maintenance_desc")}
        actions={
          <Button asChild>
            <Link href="/maintenance/new"><Plus className="h-4 w-4" />{t("ops.maintenance_new")}</Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FilterSelect
          paramName="status"
          placeholder={t("filters.status_placeholder")}
          options={[
            { value: "scheduled", label: t("ops.maintenance_status_scheduled") },
            { value: "in_progress", label: t("ops.maintenance_status_in_progress") },
            { value: "on_hold", label: t("ops.maintenance_status_on_hold") },
            { value: "completed", label: t("ops.maintenance_status_completed") },
            { value: "cancelled", label: t("ops.maintenance_status_cancelled") },
          ]}
        />
        <FilterSelect
          paramName="type"
          placeholder={t("ops.maintenance_filter_type")}
          options={[
            { value: "preventive", label: t("ops.maintenance_type_preventive") },
            { value: "corrective", label: t("ops.maintenance_type_corrective") },
            { value: "emergency", label: t("ops.maintenance_type_emergency") },
          ]}
        />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={t("ops.maintenance_empty_title")}
          description={t("ops.maintenance_empty_desc")}
          action={<Button asChild><Link href="/maintenance/new">{t("ops.maintenance_new")}</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("ops.maintenance_job_number")}</TableHead>
                <TableHead>{t("ops.maintenance_title_col")}</TableHead>
                <TableHead>{t("tables.type")}</TableHead>
                <TableHead>{t("tables.status")}</TableHead>
                <TableHead>{t("ops.maintenance_scheduled")}</TableHead>
                <TableHead className="text-right">{t("ops.maintenance_cost")}</TableHead>
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
                  <TableCell className="text-right tabular-nums">{j.cost !== null ? formatCurrency(j.cost, { currency: j.cost_currency ?? "IQD" }) : "—"}</TableCell>
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
