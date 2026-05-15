import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Edit, Home } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getCompound } from "@/lib/api/compounds";
import { listBuildingsPaged } from "@/lib/api/buildings";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function CompoundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability("compound:read");
  const { id } = await params;
  const compound = await getCompound(id);
  if (!compound) notFound();
  const { t } = await getT();

  const { data: buildings } = await listBuildingsPaged({ compoundId: id, pageSize: 50 });

  return (
    <div>
      <PageHeader
        title={compound.name}
        description={compound.description ?? compound.city ?? t("headers.compound_details_desc")}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/compounds"><ArrowLeft className="h-4 w-4" />{t("actions.back")}</Link>
            </Button>
            <Button asChild>
              <Link href={`/compounds/${compound.id}/edit`}><Edit className="h-4 w-4" />{t("actions.edit")}</Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("tables.buildings")} value={compound.total_buildings} icon={Building2} />
        <StatCard label={t("tables.units")} value={compound.total_units} icon={Home} />
        <Card>
          <CardContent className="flex flex-col gap-2 p-6">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("details.status")}</span>
            <StatusBadge status={compound.status} className="w-fit" />
            <span className="text-xs text-muted-foreground">
              {t("details.created_at", { date: formatDate(compound.created_at) })}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("tables.buildings")}</CardTitle>
            <Button asChild size="sm">
              <Link href={`/buildings/new?compound=${compound.id}`}>{t("actions.add_building")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {buildings.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t("headers.compound_no_buildings")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("tables.name")}</TableHead>
                    <TableHead>{t("tables.code")}</TableHead>
                    <TableHead className="text-right">{t("tables.floors")}</TableHead>
                    <TableHead className="text-right">{t("tables.units")}</TableHead>
                    <TableHead>{t("tables.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buildings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <Link href={`/buildings/${b.id}`} className="font-medium hover:underline">{b.name}</Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{b.code ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.number_of_floors ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.total_units}</TableCell>
                      <TableCell><StatusBadge status={b.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("headers.address_details")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label={t("details.slug")} value={<span className="font-mono">{compound.slug}</span>} />
            <Row label={t("details.code")} value={compound.code ?? "—"} />
            <Row label={t("details.city")} value={compound.city ?? "—"} />
            <Row label={t("details.region")} value={compound.region ?? "—"} />
            <Row label={t("details.country")} value={compound.country_code ?? "—"} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
