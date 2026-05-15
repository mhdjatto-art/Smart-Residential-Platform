import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, QrCode } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { VisitorActions } from "@/components/visitors/visitor-actions";
import { getVisitor } from "@/lib/api/visitors";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function VisitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability("visitor:read");
  const { id } = await params;
  const visitor = await getVisitor(id);
  if (!visitor) notFound();
  const { t } = await getT();

  return (
    <div>
      <PageHeader
        title={visitor.full_name}
        description={t("ops.visitor_pass_subtitle", { code: visitor.pass_code, type: visitor.visitor_type })}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/visitors"><ArrowLeft className="h-4 w-4" />{t("actions.back")}</Link>
            </Button>
            <VisitorActions visitorId={visitor.id} status={visitor.status} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{t("ops.visitor_details_title")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Field label={t("ops.visitor_full_name")} value={visitor.full_name} />
            <Field label={t("ops.visitor_mobile")} value={visitor.mobile ?? "—"} />
            <Field label={t("ops.visitor_id_number")} value={visitor.id_number ?? "—"} />
            <Field label={t("ops.visitor_vehicle_plate")} value={visitor.vehicle_plate ?? "—"} />
            <Field label={t("ops.visitor_type")} value={<span className="capitalize">{visitor.visitor_type}</span>} />
            <Field label={t("ops.visitor_purpose")} value={visitor.visit_purpose ?? "—"} />
            <Field label={t("ops.visitor_scheduled_date")} value={formatDate(visitor.scheduled_date)} />
            <Field label={t("ops.visitor_scheduled_time")} value={visitor.scheduled_time ?? "—"} />
            <Field label={t("ops.visitor_status")} value={<StatusBadge status={visitor.status} />} />
            <Field label={t("ops.visitor_approved_at")} value={formatDate(visitor.approved_at)} />
            <Field label={t("ops.visitor_checked_in")} value={formatDate(visitor.checked_in_at)} />
            <Field label={t("ops.visitor_checked_out")} value={formatDate(visitor.checked_out_at)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4" /> {t("ops.visitor_pass_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-40 w-40 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
              {t("ops.visitor_qr_placeholder")}
            </div>
            <div className="text-center">
              <p className="font-mono text-2xl font-bold tracking-widest">{visitor.pass_code}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("ops.visitor_present_at_gate")}</p>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              {visitor.scheduled_time
                ? t("ops.visitor_valid_for_at", { date: formatDate(visitor.scheduled_date) ?? "", time: visitor.scheduled_time })
                : t("ops.visitor_valid_for", { date: formatDate(visitor.scheduled_date) ?? "" })}
            </p>
          </CardContent>
        </Card>
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
