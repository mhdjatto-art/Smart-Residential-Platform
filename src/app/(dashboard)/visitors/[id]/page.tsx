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

export const dynamic = "force-dynamic";

export default async function VisitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const visitor = await getVisitor(id);
  if (!visitor) notFound();

  return (
    <div>
      <PageHeader
        title={visitor.full_name}
        description={`Pass ${visitor.pass_code} · ${visitor.visitor_type}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/visitors"><ArrowLeft className="h-4 w-4" />Back</Link>
            </Button>
            <VisitorActions visitorId={visitor.id} status={visitor.status} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Visitor details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Full name" value={visitor.full_name} />
            <Field label="Mobile" value={visitor.mobile ?? "—"} />
            <Field label="ID number" value={visitor.id_number ?? "—"} />
            <Field label="Vehicle plate" value={visitor.vehicle_plate ?? "—"} />
            <Field label="Type" value={<span className="capitalize">{visitor.visitor_type}</span>} />
            <Field label="Purpose" value={visitor.visit_purpose ?? "—"} />
            <Field label="Scheduled date" value={formatDate(visitor.scheduled_date)} />
            <Field label="Scheduled time" value={visitor.scheduled_time ?? "—"} />
            <Field label="Status" value={<StatusBadge status={visitor.status} />} />
            <Field label="Approved at" value={formatDate(visitor.approved_at)} />
            <Field label="Checked in" value={formatDate(visitor.checked_in_at)} />
            <Field label="Checked out" value={formatDate(visitor.checked_out_at)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4" /> Visitor pass
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-40 w-40 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
              [QR placeholder]
            </div>
            <div className="text-center">
              <p className="font-mono text-2xl font-bold tracking-widest">{visitor.pass_code}</p>
              <p className="text-xs text-muted-foreground mt-1">Present this code at the gate</p>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Valid for {formatDate(visitor.scheduled_date)}
              {visitor.scheduled_time && ` at ${visitor.scheduled_time}`}
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
