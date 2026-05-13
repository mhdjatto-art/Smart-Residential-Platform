import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Calendar, ClipboardList, Hash, MapPin, Wrench } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { StatusButtons } from "@/components/maintenance/status-buttons";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Maintenance job" };
export const dynamic = "force-dynamic";

interface JobDetail {
  id: string;
  job_number: string;
  job_type: string;
  status: string;
  title: string;
  description: string | null;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  completion_notes: string | null;
  cost: number | null;
  cost_currency: string | null;
  created_at: string;
  unit: { unit_number: string | null; building: { name: string | null } | null } | null;
  technician: { full_name: string | null; phone: string | null } | null;
  compound: { name: string | null } | null;
}

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("maintenance_jobs")
    .select(`
      id, job_number, job_type, status, title, description,
      scheduled_for, started_at, completed_at, completion_notes,
      cost, cost_currency, created_at,
      unit:units(unit_number, building:buildings(name)),
      technician:technicians(full_name, phone),
      compound:compounds(name)
    `)
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const j = data as unknown as JobDetail;

  return (
    <div>
      <PageHeader
        title={j.title}
        description={`Job #${j.job_number}`}
        actions={<StatusBadge status={j.status} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" /> Details
            </CardTitle>
            <CardDescription className="capitalize">{j.job_type} maintenance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Field icon={Hash}      label="Job number"  value={<span className="font-mono">{j.job_number}</span>} />
              <Field icon={Wrench}    label="Type"        value={<span className="capitalize">{j.job_type}</span>} />
              <Field icon={MapPin}    label="Compound"    value={j.compound?.name ?? "—"} />
              <Field icon={MapPin}    label="Unit"        value={j.unit?.unit_number ? `${j.unit.building?.name ? j.unit.building.name + " · " : ""}${j.unit.unit_number}` : "Compound-level"} />
              <Field icon={Calendar}  label="Scheduled"   value={formatDate(j.scheduled_for) || "—"} />
              <Field icon={Calendar}  label="Started"     value={j.started_at ? new Date(j.started_at).toLocaleString() : "—"} />
              <Field icon={Calendar}  label="Completed"   value={j.completed_at ? new Date(j.completed_at).toLocaleString() : "—"} />
              <Field icon={Hash}      label="Cost"        value={j.cost !== null ? formatCurrency(j.cost, { currency: j.cost_currency ?? "USD" }) : "—"} />
            </dl>

            {j.description && (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Description</p>
                <p className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{j.description}</p>
              </div>
            )}

            {j.completion_notes && (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Completion notes</p>
                <p className="rounded-md border bg-emerald-50 p-3 text-sm whitespace-pre-wrap dark:bg-emerald-950/30">{j.completion_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sidebar — technician + actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4" /> Technician
              </CardTitle>
            </CardHeader>
            <CardContent>
              {j.technician?.full_name ? (
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{j.technician.full_name}</p>
                  {j.technician.phone && <p className="text-muted-foreground">{j.technician.phone}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No technician assigned yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
              <CardDescription>Move the job through its lifecycle.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3"><Badge variant="muted" className="capitalize">{j.status.replace("_", " ")}</Badge></div>
              <StatusButtons jobId={j.id} currentStatus={j.status} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon, label, value,
}: { icon: typeof Wrench; label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}
