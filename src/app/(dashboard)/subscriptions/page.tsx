import Link from "next/link";
import { Plus, Repeat } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { listSubscriptions } from "@/lib/api/utilities";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; utility_type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { data, total } = await listSubscriptions({ status: sp.status, utilityType: sp.utility_type, page, pageSize: PAGE_SIZE });

  return (
    <div>
      <PageHeader
        title="Utility subscriptions"
        description="Recurring services that auto-generate bills: electricity, internet, gas, water, maintenance."
        actions={
          <Button asChild>
            <Link href="/subscriptions/new"><Plus className="h-4 w-4" />New subscription</Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FilterSelect paramName="utility_type" placeholder="utility"
          options={["electricity","internet","gas","water","maintenance","generator","other"].map((v) => ({ value: v, label: v }))} />
        <FilterSelect paramName="status" placeholder="status"
          options={[
            { value: "pending", label: "Pending" },
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
            { value: "cancelled", label: "Cancelled" },
            { value: "expired", label: "Expired" },
          ]} />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No subscriptions yet"
          description="Connect a unit to a utility provider so the system auto-generates monthly bills."
          action={<Button asChild><Link href="/subscriptions/new">New subscription</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead className="hidden md:table-cell">Resident</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead className="hidden lg:table-cell">Next bill</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <p className="font-medium">{s.unit_number ?? "—"}</p>
                    {s.building_name && (
                      <p className="text-[11px] text-muted-foreground">{s.building_name}</p>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{s.subscription_type}</TableCell>
                  <TableCell className="text-muted-foreground">{s.provider_name ?? "—"}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{s.resident_full_name ?? "Unit-level"}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{s.billing_cycle}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(s.monthly_fee, { currency: s.currency })}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{formatDate(s.next_billing_date)}</TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
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
