import Link from "next/link";
import { Building, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { listFacilities } from "@/lib/api/facilities";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function FacilitiesPage() {
  await requireCapability("facility:read");
  const facilities = await listFacilities();
  const { t } = await getT();

  return (
    <div>
      <PageHeader
        title={t("ops.facilities_title")}
        description={t("ops.facilities_desc")}
        actions={
          <Button asChild>
            <Link href="/facilities/new"><Plus className="h-4 w-4" />{t("ops.facilities_add")}</Link>
          </Button>
        }
      />

      {facilities.length === 0 ? (
        <EmptyState
          icon={Building}
          title={t("ops.facilities_empty_title")}
          description={t("ops.facilities_empty_desc")}
          action={<Button asChild><Link href="/facilities/new">{t("ops.facilities_add")}</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tables.name")}</TableHead>
                <TableHead>{t("tables.type")}</TableHead>
                <TableHead>{t("ops.facilities_capacity")}</TableHead>
                <TableHead>{t("ops.facilities_duration")}</TableHead>
                <TableHead>{t("ops.facilities_approval")}</TableHead>
                <TableHead className="text-right">{t("ops.facilities_fee")}</TableHead>
                <TableHead>{t("tables.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilities.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{f.facility_type.replace("_", " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{f.capacity ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{t("ops.facilities_duration_minutes", { min: f.min_duration_minutes, max: f.max_duration_minutes })}</TableCell>
                  <TableCell>{f.requires_approval ? <Badge variant="warning">{t("ops.facilities_approval_required")}</Badge> : <Badge variant="success">{t("ops.facilities_approval_auto")}</Badge>}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(f.booking_fee, { currency: f.fee_currency ?? "IQD" })}</TableCell>
                  <TableCell>{f.is_active ? <Badge variant="success">{t("status.active")}</Badge> : <Badge variant="muted">{t("status.inactive")}</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
