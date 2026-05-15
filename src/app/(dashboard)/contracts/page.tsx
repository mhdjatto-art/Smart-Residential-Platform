import Link from "next/link";
import { Download, FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchBar } from "@/components/shared/search-bar";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { listContractsPaged } from "@/lib/api/contracts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; contract_type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { t } = await getT();
  const { data, total } = await listContractsPaged({
    search: sp.q,
    status: sp.status,
    contractType: sp.contract_type,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        title="Contracts"
        titleKey="headers.contracts_title"
        description="Installment contracts: property sales, rentals, and lease-to-own agreements."
        descKey="headers.contracts_desc"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/api/exports/contracts.csv"><Download className="h-4 w-4" />{t("actions.export")}</Link>
            </Button>
            <Button asChild>
              <Link href="/contracts/new"><Plus className="h-4 w-4" />{t("actions.new")}</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2"><SearchBar placeholder={t("actions.search") + "…"} /></div>
        <FilterSelect
          paramName="contract_type"
          placeholder={t("tables.type")}
          options={[
            { value: "property_sale", label: "Property sale" },
            { value: "rental", label: "Rental" },
            { value: "lease_to_own", label: "Lease to own" },
          ]}
        />
        <FilterSelect
          paramName="status"
          placeholder={t("tables.status")}
          options={[
            { value: "draft", label: t("status.draft") },
            { value: "active", label: t("status.active") },
            { value: "completed", label: t("status.completed") },
            { value: "cancelled", label: t("status.cancelled") },
            { value: "defaulted", label: t("status.overdue") },
          ]}
        />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t("common.empty")}
          description={t("common.empty")}
          action={<Button asChild><Link href="/contracts/new">{t("actions.new")}</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tables.contract_number")}</TableHead>
                <TableHead>{t("tables.type")}</TableHead>
                <TableHead>{t("tables.status")}</TableHead>
                <TableHead className="text-right">{t("tables.total_price")}</TableHead>
                <TableHead className="text-right">{t("tables.financed")}</TableHead>
                <TableHead className="text-right">{t("tables.monthly")}</TableHead>
                <TableHead className="text-right">{t("tables.start")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => {
                const cur = c.currency ?? "USD";
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/contracts/${c.id}`} className="font-medium hover:underline">{c.contract_number}</Link>
                      <div className="text-xs text-muted-foreground">{cur}</div>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">{c.contract_type.replace(/_/g, " ")}</TableCell>
                    <TableCell><StatusBadge status={c.contract_status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(c.total_property_price, { currency: cur })}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(c.financed_amount, { currency: cur })}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.monthly_amount !== null ? formatCurrency(c.monthly_amount, { currency: cur }) : "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatDate(c.contract_start_date)}</TableCell>
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
