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
import { getT } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function UtilityBillsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; utility_type?: string; page?: string }>;
}) {
  await requireCapability("utility:read");
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { data, total } = await listUtilityBills({
    status: sp.status,
    utilityType: sp.utility_type,
    page,
    pageSize: PAGE_SIZE,
  });
  const { t } = await getT();

  return (
    <div>
      <PageHeader
        titleKey="headers.utility_bills_title"
        descKey="headers.utility_bills_desc"
        actions={
          <div className="flex flex-wrap gap-2">
            <ApplyPenaltiesButton />
            <GenerateRecurringButton />
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FilterSelect paramName="utility_type" placeholder={t("filters.utility_placeholder")}
          options={["electricity","internet","gas","water","maintenance","generator","other"].map((v) => ({ value: v, label: t(`utility_types.${v}` as TranslationKey) }))} />
        <FilterSelect paramName="status" placeholder={t("filters.status_placeholder")}
          options={[
            { value: "draft", label: t("status.draft") },
            { value: "issued", label: t("status.issued") },
            { value: "partial", label: t("status.partial") },
            { value: "paid", label: t("status.paid") },
            { value: "overdue", label: t("status.overdue") },
            { value: "cancelled", label: t("status.cancelled") },
          ]} />
      </div>

      {data.length === 0 ? (
        <EmptyState icon={Receipt} title={t("headers.no_utility_bills_title")} description={t("headers.no_utility_bills_desc")} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tables.bill_number")}</TableHead>
                <TableHead>{t("tables.type")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("tables.period")}</TableHead>
                <TableHead>{t("tables.due")}</TableHead>
                <TableHead className="text-right">{t("tables.total")}</TableHead>
                <TableHead className="text-right">{t("tables.penalty")}</TableHead>
                <TableHead className="text-right">{t("tables.paid")}</TableHead>
                <TableHead className="text-right">{t("tables.owed")}</TableHead>
                <TableHead>{t("tables.status")}</TableHead>
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
                    <TableCell className="text-muted-foreground">{t(`utility_types.${b.utility_type}` as TranslationKey)}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {t("common.period_range", { start: formatDate(b.billing_period_start), end: formatDate(b.billing_period_end) })}
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
