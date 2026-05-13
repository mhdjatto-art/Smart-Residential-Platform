import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { GenerateRecurringButton } from "@/components/utility-bills/generate-button";
import { ApplyPenaltiesButton } from "@/components/utility-bills/apply-penalties-button";
import { PayBillDialog } from "@/components/utility-bills/pay-bill-dialog";
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
        description="Electricity, internet, gas, water, and recurring service bills. Apply penalties and record payments."
        actions={
          <div className="flex flex-wrap gap-2">
            <ApplyPenaltiesButton />
            <GenerateRecurringButton />
          </div>
        }
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
                <TableHead className="hidden md:table-cell">Period</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Penalty</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Owed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((b) => {
                const owed = Math.max(0, b.total_amount + (b.penalty_amount ?? 0) - (b.paid_amount ?? 0));
                const fullyPaid = b.status === "paid" || owed < 0.01;
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.bill_number}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{b.utility_type}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatDate(b.billing_period_start)} → {formatDate(b.billing_period_end)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(b.due_date)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrency(b.total_amount, { currency: b.currency })}</TableCell>
                    <TableCell className={`text-right tabular-nums ${b.penalty_amount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                      {b.penalty_amount > 0 ? formatCurrency(b.penalty_amount, { currency: b.currency }) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(b.paid_amount, { currency: b.currency })}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${owed > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {owed > 0 ? formatCurrency(owed, { currency: b.currency }) : "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={b.status} /></TableCell>
                    <TableCell>
                      {!fullyPaid && b.status !== "cancelled" && (
                        <PayBillDialog
                          billId={b.id}
                          billNumber={b.bill_number}
                          totalAmount={b.total_amount}
                          penaltyAmount={b.penalty_amount ?? 0}
                          paidAmount={b.paid_amount ?? 0}
                          currency={b.currency}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination total={total} pageSize={PAGE_SIZE} page={page} />
        </Card>
      )}
    </div>
  );
}
