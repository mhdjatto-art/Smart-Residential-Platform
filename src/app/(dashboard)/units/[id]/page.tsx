import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Edit, Home, QrCode } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { AssignmentSection } from "@/components/assignments/assignment-section";
import { ActivityTimeline } from "@/components/audit/activity-timeline";
import { getUnit } from "@/lib/api/units";
import { listAssignmentsByUnit } from "@/lib/api/assignments";
import { listResidentOptions } from "@/lib/api/residents";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const unit = await getUnit(id);
  if (!unit) notFound();
  const { t } = await getT();

  const supabase = await createClient();
  const [assignments, residents] = await Promise.all([
    listAssignmentsByUnit(id),
    listResidentOptions(unit.compound_id),
  ]);

  // Look up resident names so the assignments table doesn't show raw UUIDs.
  const residentIds = Array.from(new Set(assignments.map((a) => a.resident_id)));
  const residentNames: Record<string, string> = {};
  if (residentIds.length > 0) {
    const { data } = await supabase
      .from("residents")
      .select("id, first_name, last_name")
      .in("id", residentIds);
    for (const r of (data ?? []) as unknown as Array<{ id: string; first_name: string; last_name: string }>) {
      residentNames[r.id] = `${r.first_name} ${r.last_name}`;
    }
  }

  return (
    <div>
      <PageHeader
        title={t("details.unit_label", { number: unit.unit_number })}
        description={t("details.unit_subtitle", {
          type: unit.unit_type,
          beds: unit.bedrooms ?? "?",
          baths: unit.bathrooms ?? "?",
        })}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/buildings/${unit.building_id}`}><ArrowLeft className="h-4 w-4" />{t("actions.building")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/units/${unit.id}/barcode`}><QrCode className="h-4 w-4" />{t("actions.barcode")}</Link>
            </Button>
            <Button asChild>
              <Link href={`/units/${unit.id}/edit`}><Edit className="h-4 w-4" />{t("actions.edit")}</Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>{t("common.details")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Field label={t("details.type")} value={<span className="capitalize">{unit.unit_type}</span>} />
            <Field label={t("details.status")} value={<StatusBadge status={unit.status} />} />
            <Field label={t("details.ownership")} value={<StatusBadge status={unit.ownership_status} />} />
            <Field label={t("details.floor")} value={unit.floor ?? "—"} />
            <Field label={t("details.bedrooms")} value={unit.bedrooms ?? "—"} />
            <Field label={t("details.bathrooms")} value={unit.bathrooms ?? "—"} />
            <Field label={t("details.parking")} value={unit.parking_slots} />
            <Field label={t("details.area_sqm")} value={unit.area_sqm ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("headers.pricing_title")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Field label={t("details.purchase_price")} value={unit.purchase_price ?? "—"} />
            <Field label={t("details.monthly_rent")} value={unit.rent_price ?? "—"} />
            <Field label={t("details.maintenance_fee")} value={unit.maintenance_fee ?? "—"} />
            <Field label={t("details.created")} value={formatDate(unit.created_at)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              {t("headers.unit_notes_title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {unit.description ?? t("headers.unit_no_description")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <AssignmentSection
          unitId={unit.id}
          assignments={assignments}
          residents={residents}
          residentNames={residentNames}
        />
      </div>

      <div className="mt-6">
        <ActivityTimeline table="units" rowId={unit.id} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
