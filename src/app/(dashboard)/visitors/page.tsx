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

  return (
    <div>
      <PageHeader
        title="Visitors"
        description="Visitor registry with QR-coded passes and security logs."
        actions={
          <Button asChild>
            <Link href="/visitors/new"><Plus className="h-4 w-4" />New visitor</Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2"><SearchBar placeholder="Search name, pass code, mobile…" /></div>
        <FilterSelect
          paramName="visitor_type"
          placeholder="type"
          options={[
            { value: "guest", label: "Guest" },
            { value: "delivery", label: "Delivery" },
            { value: "maintenance", label: "Maintenance" },
            { value: "contractor", label: "Contractor" },
          ]}
        />
        <FilterSelect
          paramName="status"
          placeholder="status"
          options={[
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "checked_in", label: "Checked in" },
            { value: "checked_out", label: "Checked out" },
            { value: "expired", label: "Expired" },
          ]}
        />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No visitors yet"
          description="Register visitors to issue passes and track entries."
          action={<Button asChild><Link href="/visitors/new">New visitor</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pass</TableHead>
                <TableHead>Visitor</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
                <TableHead className="hidden lg:table-cell">Time</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
