import Link from "next/link";
import { DollarSign, Download, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchBar } from "@/components/shared/search-bar";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { listPaymentsPaged } from "@/lib/api/payments";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; method?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { data, total } = await listPaymentsPaged({
    search: sp.q,
    status: sp.status,
    method: sp.method,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        title="Payments"
        titleKey="headers.payments_title"
        description="All recorded payments across active contracts."
        descKey="headers.payments_desc"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/api/exports/payments.csv"><Download className="h-4 w-4" />Export CSV</Link>
            </Button>
            <Button asChild>
              <Link href="/payments/new"><Plus className="h-4 w-4" />Record payment</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2"><SearchBar placeholder="Search by reference…" /></div>
        <FilterSelect
          paramName="status"
          placeholder="status"
          options={[
            { value: "confirmed", label: "Confirmed" },
            { value: "reversed", label: "Reversed" },
            { value: "refunded", label: "Refunded" },
          ]}
        />
        <FilterSelect
          paramName="method"
          placeholder="method"
          options={[
            { value: "cash", label: "Cash" },
            { value: "bank_transfer", label: "Bank transfer" },
            { value: "online_payment", label: "Online" },
            { value: "wallet", label: "Wallet" },
            { value: "cheque", label: "Cheque" },
          ]}
        />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No payments recorded"
          description="Record payments against active contracts."
          action={<Button asChild><Link href="/payments/new">Record payment</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/payments/${p.id}`} className="font-medium hover:underline font-mono">
                      {p.payment_reference}
                    </Link>
                    <div className="text-xs text-muted-foreground">{p.currency ?? "USD"}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.payment_date)}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{p.payment_method.replace("_", " ")}</TableCell>
                  <TableCell><StatusBadge status={p.payment_status} /></TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(p.payment_amount, { currency: p.currency ?? "USD" })}</TableCell>
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
