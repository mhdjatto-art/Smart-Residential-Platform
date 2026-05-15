import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchBar } from "@/components/shared/search-bar";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { listResidentsPaged } from "@/lib/api/residents";
import { listCompoundOptions } from "@/lib/api/compounds";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function ResidentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string; status?: string; tenancy?: string; compound?: string; page?: string;
  }>;
}) {
  await requireCapability("resident:read");
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { t } = await getT();

  const [{ data, total }, compounds] = await Promise.all([
    listResidentsPaged({
      search: sp.q,
      status: sp.status,
      tenancyType: sp.tenancy,
      compoundId: sp.compound,
      page,
      pageSize: PAGE_SIZE,
    }),
    listCompoundOptions(),
  ]);

  return (
    <div>
      <PageHeader
        title={t("headers.residents_title")}
        titleKey="headers.residents_title"
        description={t("headers.residents_desc")}
        descKey="headers.residents_desc"
        actions={
          <Button asChild>
            <Link href="/residents/new"><Plus className="h-4 w-4" />{t("actions.add")}</Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2"><SearchBar placeholder={t("actions.search") + "…"} /></div>
        <FilterSelect
          paramName="compound"
          placeholder={t("nav.compounds")}
          options={compounds.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect
          paramName="tenancy"
          placeholder={t("tables.tenancy")}
          options={[
            { value: "owner", label: t("tenancy.owner") },
            { value: "tenant", label: t("tenancy.tenant") },
            { value: "family_member", label: t("tenancy.family_member") },
            { value: "guest", label: t("tenancy.guest") },
          ]}
        />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("common.empty")}
          description={t("dashboard.no_residents_yet")}
          action={<Button asChild><Link href="/residents/new">{t("actions.add")}</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tables.name")}</TableHead>
                <TableHead>{t("tables.email")}</TableHead>
                <TableHead>{t("tables.mobile")}</TableHead>
                <TableHead>{t("tables.tenancy")}</TableHead>
                <TableHead>{t("tables.status")}</TableHead>
                <TableHead className="text-right">{t("tables.added")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => {
                const tenancyKey = `tenancy.${r.tenancy_type}` as Parameters<typeof t>[0];
                const tenancyOut = t(tenancyKey);
                const tenancyLabel = tenancyOut === tenancyKey
                  ? r.tenancy_type.replace("_", " ")
                  : tenancyOut;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/residents/${r.id}`} className="font-medium hover:underline">
                        {r.first_name} {r.last_name}
                      </Link>
                      {r.national_id && (
                        <div className="text-xs font-mono text-muted-foreground">{t("details.national_id_value", { id: r.national_id })}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{r.mobile ?? r.phone ?? "—"}</TableCell>
                    <TableCell>{tenancyLabel}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatDate(r.created_at)}</TableCell>
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
