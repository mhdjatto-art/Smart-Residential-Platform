import Link from "next/link";
import { Plus, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchBar } from "@/components/shared/search-bar";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { VisitorActions } from "@/components/visitors/visitor-actions";
import { VisitorQr } from "@/components/visitors/visitor-qr";
import { listVisitorsPaged } from "@/lib/api/visitors";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function VisitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; visitor_type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { data, total } = await listVisitorsPaged({
    search: sp.q,
    status: sp.status,
    visitorType: sp.visitor_type,
    page,
    pageSize: PAGE_SIZE,
  });
  const { t } = await getT();

  return (
    <div>
      <PageHeader
        titleKey="headers.visitors_title"
        description={t("ops.visitors_desc")}
        actions={
          <Button asChild>
            <Link href="/visitors/new"><Plus className="h-4 w-4" />{t("actions.new")}</Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2"><SearchBar placeholder={t("ops.visitors_search_ph")} /></div>
        <FilterSelect
          paramName="visitor_type"
          placeholder={t("ops.visitors_filter_type")}
          options={[
            { value: "guest", label: t("ops.visitor_type_guest") },
            { value: "delivery", label: t("ops.visitor_type_delivery") },
            { value: "maintenance", label: t("ops.visitor_type_maintenance") },
            { value: "contractor", label: t("ops.visitor_type_contractor") },
          ]}
        />
        <FilterSelect
          paramName="status"
          placeholder={t("filters.status_placeholder")}
          options={[
            { value: "pending", label: t("ops.visitor_status_pending") },
            { value: "approved", label: t("ops.visitor_status_approved") },
            { value: "rejected", label: t("ops.visitor_status_rejected") },
            { value: "checked_in", label: t("ops.visitor_status_checked_in") },
            { value: "checked_out", label: t("ops.visitor_status_checked_out") },
            { value: "expired", label: t("ops.visitor_status_expired") },
          ]}
        />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title={t("ops.visitors_no_results_title")}
          description={t("ops.visitors_no_results_desc")}
          action={<Button asChild><Link href="/visitors/new">{t("actions.new")}</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tables.pass")}</TableHead>
                <TableHead>{t("tables.visitor")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("tables.type")}</TableHead>
                <TableHead>{t("tables.status")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("tables.date")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("mobile.time")}</TableHead>
                <TableHead className="text-right">{t("common.actions_col")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <Link href={`/visitors/${v.id}`} className="font-mono font-medium hover:underline">{v.pass_code}</Link>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{v.full_name}</p>
                      {v.mobile && <p className="text-xs text-muted-foreground">{v.mobile}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden capitalize text-muted-foreground md:table-cell">{v.visitor_type}</TableCell>
                  <TableCell><StatusBadge status={v.status} /></TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{formatDate(v.scheduled_date)}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{v.scheduled_time ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {(v.status === "approved" || v.status === "checked_in") && (
                        <VisitorQr passCode={v.pass_code} visitorName={v.full_name} scheduledDate={formatDate(v.scheduled_date) ?? v.scheduled_date} />
                      )}
                      <VisitorActions visitorId={v.id} status={v.status} compact />
                    </div>
                  </TableCell>
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
