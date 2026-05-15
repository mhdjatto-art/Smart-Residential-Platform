import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { BookingActions } from "@/components/bookings/booking-actions";
import { listBookings } from "@/lib/api/facilities";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
  catch { return iso; }
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { data, total } = await listBookings({ status: sp.status, page, pageSize: PAGE_SIZE });
  const { t } = await getT();

  const pendingCount = data.filter((b) => b.status === "pending").length;

  return (
    <div>
      <PageHeader
        title={t("ops.bookings_title")}
        description={t("ops.bookings_desc")}
        actions={
          <Button asChild>
            <Link href="/bookings/new"><Plus className="h-4 w-4" />{t("ops.bookings_new")}</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterSelect
          paramName="status"
          placeholder={t("filters.status_placeholder")}
          options={[
            { value: "pending", label: t("ops.bookings_status_pending") },
            { value: "approved", label: t("ops.bookings_status_approved") },
            { value: "rejected", label: t("ops.bookings_status_rejected") },
            { value: "cancelled", label: t("ops.bookings_status_cancelled") },
            { value: "completed", label: t("ops.bookings_status_completed") },
          ]}
        />
        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            ⏳ {pendingCount === 1 ? t("ops.bookings_pending_count_one", { n: pendingCount }) : t("ops.bookings_pending_count_many", { n: pendingCount })}
          </span>
        )}
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t("ops.bookings_empty_title")}
          description={t("ops.bookings_empty_desc")}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("ops.bookings_facility")}</TableHead>
                <TableHead>{t("ops.bookings_resident")}</TableHead>
                <TableHead>{t("ops.bookings_start")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("ops.bookings_end")}</TableHead>
                <TableHead>{t("tables.status")}</TableHead>
                <TableHead className="hidden text-right lg:table-cell">{t("ops.bookings_fee")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("ops.bookings_paid_col")}</TableHead>
                <TableHead className="text-right">{t("common.actions_col")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <p className="font-medium">{b.facility_name ?? "—"}</p>
                    {b.facility_type && (
                      <p className="text-[10px] capitalize text-muted-foreground">{b.facility_type.replace(/_/g, " ")}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{b.resident_name ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(b.start_time)}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">{formatDateTime(b.end_time)}</TableCell>
                  <TableCell>
                    <StatusBadge status={b.status} />
                    {b.status === "rejected" && b.rejected_reason && (
                      <p className="mt-0.5 max-w-xs truncate text-[10px] text-destructive" title={b.rejected_reason}>
                        {b.rejected_reason}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">
                    {b.fee_amount > 0 ? formatCurrency(b.fee_amount) : t("ops.bookings_free")}
                  </TableCell>
                  <TableCell className="hidden text-xs lg:table-cell">
                    {b.fee_amount > 0 ? (b.fee_paid ? "✓" : "—") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <BookingActions bookingId={b.id} status={b.status} />
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
