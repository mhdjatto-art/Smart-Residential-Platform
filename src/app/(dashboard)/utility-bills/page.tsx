import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { GenerateRecurringButton } from "@/components/utility-bills/generate-button";
import { listUtilityBills } from "@/lib/api/utilities";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function UtilityBillsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; utility_type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { data, total } = await listUtilityBills({
    status: sp.status,
    utilityType: sp.utility_type,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        title="Utility bills"
        description="Electricity, internet, gas, water, and recurring service bills."
        actions={<GenerateRecurringButton />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FilterSelect paramName="utility_type" placeholder="utility"
          options={["electricity","internet","gas","water","maintenance","generator","other"].map((v) => ({ value: v, label: v }))} />
        <FilterSelect paramName="status" placeholder="status"
          options={[
            { value: "draft", label: "Draft" },
            { value: "issued", label: "Issued" },
            { value: "partial", label: "Partial" },
            { value: "paid", label: "Paid" },
            { value: "overdue", label: "Overdue" },
            { value: "cancelled", label: "Cancelled" },
          ]} />
      </div>

      {data.length === 0 ? (
        <EmptyState icon={Receipt} title="No utility bills" description="Generate recurring bills or create one from a meter reading." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Consumption</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">{b.bill_number}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{b.utility_type}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(b.billing_period_start)} → {formatDate(b.billing_period_end)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(b.due_date)}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.consumption !== null ? b.consumption.toFixed(2) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(b.total_amount, { currency: b.currency })}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(b.paid_amount, { currency: b.currency })}</TableCell>
                  <TableCell><StatusBadge status={b.status} /></TableCell>
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
