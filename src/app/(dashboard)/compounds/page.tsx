import Link from "next/link";
import { Plus, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchBar } from "@/components/shared/search-bar";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { listCompoundsPaged } from "@/lib/api/compounds";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function CompoundsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireCapability("compound:read");
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { t } = await getT();

  const { data, total } = await listCompoundsPaged({
    search: sp.q,
    status: sp.status,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        title={t("headers.compounds_title")}
        titleKey="headers.compounds_title"
        description={t("headers.compounds_desc")}
        descKey="headers.compounds_desc"
        actions={
          <Button asChild>
            <Link href="/compounds/new">
              <Plus className="h-4 w-4" />
              {t("actions.add")}
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 max-w-md">
          <SearchBar placeholder={t("actions.search") + "…"} className="w-full" />
        </div>
        <FilterSelect
          paramName="status"
          placeholder={t("tables.status")}
          options={[
            { value: "active", label: t("unit_status.active") },
            { value: "inactive", label: t("unit_status.inactive") },
            { value: "archived", label: t("unit_status.archived") },
          ]}
        />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title={t("common.empty")}
          description={t("common.empty")}
          action={
            <Button asChild>
              <Link href="/compounds/new">{t("actions.add")}</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tables.name")}</TableHead>
                <TableHead>{t("tables.code")}</TableHead>
                <TableHead>{t("tables.city")}</TableHead>
                <TableHead className="text-right">{t("tables.buildings")}</TableHead>
                <TableHead className="text-right">{t("tables.units")}</TableHead>
                <TableHead>{t("tables.status")}</TableHead>
                <TableHead className="text-right">{t("tables.created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/compounds/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <div className="text-xs text-muted-foreground font-mono">{c.slug}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.code ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.city ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.total_buildings}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.total_units}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(c.created_at)}</TableCell>
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
