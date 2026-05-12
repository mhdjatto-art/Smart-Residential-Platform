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
        description="Recurring services: electricity, internet, gas, water, maintenance."
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
        <EmptyState icon={Repeat} title="No subscriptions yet" description="Connect units to recurring utility services."
          action={<Button asChild><Link href="/subscriptions/new">New subscription</Link></Button>} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Next bill</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="capitalize">{s.subscription_type}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{s.billing_cycle}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(s.monthly_fee, { currency: s.currency })}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(s.start_date)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(s.next_billing_date)}</TableCell>
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
