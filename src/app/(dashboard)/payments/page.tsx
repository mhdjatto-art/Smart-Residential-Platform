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
import { getT } from "@/lib/i18n/server";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; method?: string; page?: string }>;
}) {
  await requireCapability("payment:read");
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { t } = await getT();
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
              <Link href="/api/exports/payments.csv"><Download className="h-4 w-4" />{t("actions.export")}</Link>
            </Button>
            <Button asChild>
              <Link href="/payments/new"><Plus className="h-4 w-4" />{t("actions.new")}</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2"><SearchBar placeholder={t("actions.search") + "…"} /></div>
        <FilterSelect
          paramName="status"
          placeholder={t("tables.status")}
          options={[
            { value: "confirmed", label: t("status.confirmed") },
            { value: "reversed", label: t("status.cancelled") },
            { value: "refunded", label: t("status.refunded") },
          ]}
        />
        <FilterSelect
          paramName="method"
          placeholder={t("tables.method")}
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
          title={t("common.empty")}
          description={t("common.empty")}
          action={<Button asChild><Link href="/payments/new">{t("actions.new")}</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tables.reference")}</TableHead>
                <TableHead>{t("tables.date")}</TableHead>
                <TableHead>{t("tables.method")}</TableHead>
                <TableHead>{t("tables.status")}</TableHead>
                <TableHead className="text-right">{t("tables.amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/payments/${p.id}`} className="font-medium hover:underline font-mono">
                      {p.payment_reference}
                    </Link>
                    <div className="text-xs text-muted-foreground">{p.currency ?? "IQD"}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.payment_date)}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{p.payment_method.replace("_", " ")}</TableCell>
                  <TableCell><StatusBadge status={p.payment_status} /></TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(p.payment_amount, { currency: p.currency ?? "IQD" })}</TableCell>
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
