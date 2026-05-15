import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchBar } from "@/components/shared/search-bar";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { listBuildingsPaged } from "@/lib/api/buildings";
import { listCompoundOptions } from "@/lib/api/compounds";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function BuildingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; compound?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { t } = await getT();

  const [{ data, total }, compounds] = await Promise.all([
    listBuildingsPaged({ search: sp.q, status: sp.status, compoundId: sp.compound, page, pageSize: PAGE_SIZE }),
    listCompoundOptions(),
  ]);

  return (
    <div>
      <PageHeader
        title="Buildings"
        titleKey="headers.buildings_title"
        description="Buildings across your compounds."
        descKey="headers.buildings_desc"
        actions={
          <Button asChild>
            <Link href="/buildings/new"><Plus className="h-4 w-4" />{t("actions.add")}</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar placeholder={t("actions.search") + "…"} className="sm:max-w-md sm:flex-1" />
        <div className="flex gap-2">
          <FilterSelect
            paramName="compound"
            placeholder={t("nav.compounds")}
            options={compounds.map((c) => ({ value: c.id, label: c.name }))}
          />
          <FilterSelect
            paramName="status"
            placeholder={t("tables.status")}
            options={[
              { value: "active", label: t("unit_status.active") },
              { value: "inactive", label: t("unit_status.inactive") },
              { value: "under_construction", label: t("unit_status.under_construction") },
            ]}
          />
        </div>
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("common.empty")}
          description={t("common.empty")}
          action={
            <Button asChild><Link href="/buildings/new">{t("actions.add")}</Link></Button>
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tables.name")}</TableHead>
                <TableHead>{t("tables.code")}</TableHead>
                <TableHead className="text-right">{t("tables.floors")}</TableHead>
                <TableHead className="text-right">{t("tables.units")}</TableHead>
                <TableHead>{t("tables.status")}</TableHead>
                <TableHead className="text-right">{t("tables.created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/buildings/${b.id}`} className="font-medium hover:underline">{b.name}</Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{b.code ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.number_of_floors ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.total_units}</TableCell>
                  <TableCell><StatusBadge status={b.status} /></TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(b.created_at)}</TableCell>
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
