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
import { listBookings } from "@/lib/api/facilities";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { data, total } = await listBookings({ status: sp.status, page, pageSize: PAGE_SIZE });

  return (
    <div>
      <PageHeader
        title="Facility bookings"
        description="Reservations across all facilities, pending approvals, and history."
        actions={
          <Button asChild>
            <Link href="/bookings/new"><Plus className="h-4 w-4" />New booking</Link>
          </Button>
        }
      />

      <div className="mb-4">
        <FilterSelect
          paramName="status"
          placeholder="status"
          options={[
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "cancelled", label: "Cancelled" },
            { value: "completed", label: "Completed" },
          ]}
        />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No bookings yet"
          description="Bookings will appear here when residents reserve facilities."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-muted-foreground">{formatDate(b.start_time)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(b.end_time)}</TableCell>
                  <TableCell><StatusBadge status={b.status} /></TableCell>
                  <TableCell className="tabular-nums">{formatCurrency(b.fee_amount)}</TableCell>
                  <TableCell>{b.fee_paid ? "Yes" : "No"}</TableCell>
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
