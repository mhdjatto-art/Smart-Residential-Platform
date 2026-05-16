import { AlertOctagon, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchBar } from "@/components/shared/search-bar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecordCashButton } from "@/components/payments/record-cash-button";
import { listCashierQueue } from "@/lib/api/cashier-queue";
import { requireCapability } from "@/lib/auth/guards";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function CashierQuickPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; overdue?: string }>;
}) {
  await requireCapability("payment:write");
  const sp = await searchParams;
  const { t } = await getT();

  const onlyOverdue = sp.overdue === "1";
  const rows = await listCashierQueue({ search: sp.q, onlyOverdue, limit: 200 });
  const today = new Date().toISOString().slice(0, 10);

  const totals = {
    count: rows.length,
    overdueCount: rows.filter((r) => r.due_date <= today).length,
    sum: rows.reduce((s, r) => s + r.remaining, 0),
  };

  return (
    <div>
      <PageHeader
        title="Cashier — quick record"
        titleKey="cashier.page_title"
        description="Find an unpaid installment and record a cash/cheque/bank payment in one click."
        descKey="cashier.page_desc"
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("cashier.stat_total_rows")}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{totals.count}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("cashier.stat_overdue")}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-destructive">{totals.overdueCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("cashier.stat_outstanding")}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(totals.sum)}</p>
        </CardContent></Card>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1"><SearchBar placeholder={t("cashier.search_placeholder")} /></div>
        <div className="flex gap-2">
          <a
            href="/payments/quick"
            className={`rounded-full border px-3 py-1.5 text-xs ${!onlyOverdue ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          >
            {t("cashier.filter_all")}
          </a>
          <a
            href="/payments/quick?overdue=1"
            className={`rounded-full border px-3 py-1.5 text-xs ${onlyOverdue ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          >
            {t("cashier.filter_overdue")}
          </a>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-10 text-center">
              <CalendarClock className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">{t("cashier.empty")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tables.resident")}</TableHead>
                  <TableHead>{t("tables.contract")}</TableHead>
                  <TableHead>{t("cashier.kind")}</TableHead>
                  <TableHead>{t("tables.unit")}</TableHead>
                  <TableHead>{t("tables.due_date")}</TableHead>
                  <TableHead className="text-end">{t("cashier.remaining")}</TableHead>
                  <TableHead className="text-end">{t("tables.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const overdue = r.due_date <= today;
                  const isRent  = r.contract_type === "rental";
                  return (
                    <TableRow key={r.installment_id}>
                      <TableCell className="font-medium">{r.resident_name}</TableCell>
                      <TableCell className="font-mono text-xs">{r.contract_number}</TableCell>
                      <TableCell>
                        <Badge variant={isRent ? "muted" : "default"} className="text-[10px]">
                          {isRent ? t("cashier.kind_rent") : t("cashier.kind_installment")} #{r.installment_number}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.building_name ? `${r.building_name} · ` : ""}{r.unit_number ?? "—"}
                      </TableCell>
                      <TableCell className={overdue ? "text-destructive" : ""}>
                        {overdue && <AlertOctagon className="inline h-3 w-3 me-1" />}
                        {formatDate(r.due_date)}
                      </TableCell>
                      <TableCell className="text-end font-semibold tabular-nums">
                        {formatCurrency(r.remaining, { currency: r.currency })}
                        {r.penalty_amount > 0 && (
                          <p className="text-[10px] text-amber-700">+ {formatCurrency(r.penalty_amount, { currency: r.currency })} fee</p>
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        <RecordCashButton
                          contractId={r.contract_id}
                          contractNumber={r.contract_number}
                          residentName={r.resident_name}
                          remaining={r.remaining}
                          installmentNumber={r.installment_number}
                          isRent={isRent}
                          currency={r.currency}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
