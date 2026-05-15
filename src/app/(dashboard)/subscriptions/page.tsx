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
import { getT } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; utility_type?: string; page?: string }>;
}) {
  await requireCapability("utility:read");
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { data, total } = await listSubscriptions({ status: sp.status, utilityType: sp.utility_type, page, pageSize: PAGE_SIZE });
  const { t } = await getT();

  return (
    <div>
      <PageHeader
        title={t("ops.subscriptions_title")}
        description={t("ops.subscriptions_desc")}
        actions={
          <Button asChild>
            <Link href="/subscriptions/new"><Plus className="h-4 w-4" />{t("ops.subscriptions_new")}</Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FilterSelect paramName="utility_type" placeholder={t("filters.utility_placeholder")}
          options={["electricity","internet","gas","water","maintenance","generator","other"].map((v) => ({ value: v, label: t(`utility_types.${v}` as TranslationKey) }))} />
        <FilterSelect paramName="status" placeholder={t("filters.status_placeholder")}
          options={[
            { value: "pending", label: t("ops.subscriptions_status_pending") },
            { value: "active", label: t("ops.subscriptions_status_active") },
            { value: "suspended", label: t("ops.subscriptions_status_suspended") },
            { value: "cancelled", label: t("ops.subscriptions_status_cancelled") },
            { value: "expired", label: t("ops.subscriptions_status_expired") },
          ]} />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title={t("ops.subscriptions_empty_title")}
          description={t("ops.subscriptions_empty_desc")}
          action={<Button asChild><Link href="/subscriptions/new">{t("ops.subscriptions_new")}</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("ops.subscriptions_unit")}</TableHead>
                <TableHead>{t("ops.subscriptions_service")}</TableHead>
                <TableHead>{t("ops.subscriptions_provider")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("ops.subscriptions_resident")}</TableHead>
                <TableHead>{t("ops.subscriptions_cycle")}</TableHead>
                <TableHead className="text-right">{t("ops.subscriptions_fee")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("ops.subscriptions_next_bill")}</TableHead>
                <TableHead>{t("tables.status")}</TableHead>
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
                  <TableCell className="hidden text-muted-foreground md:table-cell">{s.resident_full_name ?? t("ops.subscriptions_unit_level")}</TableCell>
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
