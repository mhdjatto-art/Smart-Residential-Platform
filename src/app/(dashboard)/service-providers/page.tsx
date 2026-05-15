import Link from "next/link";
import { Plus, Store, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { listServiceProviders } from "@/lib/api/marketplace";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function ServiceProvidersPage() {
  const providers = await listServiceProviders();
  const { t } = await getT();
  return (
    <div>
      <PageHeader
        titleKey="headers.providers_title"
        descKey="headers.providers_desc"
        actions={
          <Button asChild>
            <Link href="/service-providers/new"><Plus className="h-4 w-4" />{t("ops.providers_add")}</Link>
          </Button>
        }
      />
      {providers.length === 0 ? (
        <EmptyState
          icon={Store}
          title={t("ops.providers_empty_title")}
          description={t("ops.providers_empty_desc")}
          action={<Button asChild><Link href="/service-providers/new">{t("ops.providers_add")}</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tables.name")}</TableHead>
                <TableHead>{t("ops.providers_kind")}</TableHead>
                <TableHead>{t("ops.providers_rating")}</TableHead>
                <TableHead>{t("ops.providers_verified")}</TableHead>
                <TableHead>{t("ops.providers_availability")}</TableHead>
                <TableHead>{t("ops.providers_commission")}</TableHead>
                <TableHead>{t("tables.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => (
                <TableRow key={p.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/service-providers/${p.id}`} className="hover:underline">{p.provider_name}</Link>
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{p.provider_kind.replace("_", " ")}</TableCell>
                  <TableCell className="text-sm">
                    {p.rating_count > 0 ? (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 stroke-amber-500" />
                        {p.rating_avg.toFixed(2)} <span className="text-xs text-muted-foreground">({p.rating_count})</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("ops.providers_no_reviews")}</span>
                    )}
                  </TableCell>
                  <TableCell><StatusBadge status={p.verification_status} /></TableCell>
                  <TableCell><StatusBadge status={p.availability_status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.default_commission_kind === "percentage"
                      ? `${p.default_commission_value}%`
                      : `${p.default_commission_value} flat`}
                  </TableCell>
                  <TableCell><StatusBadge status={p.is_active ? "active" : "inactive"} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
