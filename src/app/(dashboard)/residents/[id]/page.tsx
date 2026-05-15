import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Edit } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { getResident } from "@/lib/api/residents";
import { listAssignmentsByResident } from "@/lib/api/assignments";
import { listDocuments, getDocumentSignedUrl } from "@/lib/api/documents";
import { createClient } from "@/lib/supabase/server";
import { formatDate, initials } from "@/lib/utils";
import { DocumentSection } from "@/components/documents/document-section";
import { getT, type T } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function ResidentDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const resident = await getResident(id);
  if (!resident) notFound();
  const { t } = await getT();

  const TABS = [
    { value: "profile",     label: t("tabs.profile") },
    { value: "assignments", label: t("tabs.assignments") },
    { value: "documents",   label: t("tabs.documents") },
  ];

  const fullName = `${resident.first_name} ${resident.last_name}`;

  return (
    <div>
      <PageHeader
        title={fullName}
        description={resident.occupation ?? resident.email ?? t("headers.resident_profile_desc")}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/residents"><ArrowLeft className="h-4 w-4" />{t("actions.back")}</Link>
            </Button>
            <Button asChild>
              <Link href={`/residents/${resident.id}/edit`}><Edit className="h-4 w-4" />{t("actions.edit")}</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex items-center gap-4 rounded-xl border bg-card p-4">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="text-lg">{initials(fullName)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{fullName}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="capitalize">{(resident.tenancy_type ?? "").toString().replace(/_/g, " ") || "—"}</span>
            ·
            <StatusBadge status={resident.status} />
          </div>
        </div>
      </div>

      <Tabs tabs={TABS} defaultValue="profile" className="mb-6" />

      {(tab ?? "profile") === "profile" && <ProfileTab resident={resident} t={t} />}
      {tab === "assignments" && <AssignmentsTab residentId={resident.id} t={t} />}
      {tab === "documents" && <DocumentsTab residentId={resident.id} />}
    </div>
  );
}

function ProfileTab({ resident, t }: { resident: Awaited<ReturnType<typeof getResident>>; t: T }) {
  if (!resident) return null;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>{t("headers.resident_identity")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <Field label={t("details.first_name")} value={resident.first_name} />
          <Field label={t("details.last_name")} value={resident.last_name} />
          <Field label={t("details.gender")} value={<span className="capitalize">{resident.gender}</span>} />
          <Field label={t("details.date_of_birth")} value={formatDate(resident.date_of_birth)} />
          <Field label={t("details.national_id")} value={resident.national_id ?? "—"} />
          <Field label={t("details.occupation")} value={resident.occupation ?? "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("headers.resident_contact")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <Field label={t("details.email")} value={resident.email ?? "—"} />
          <Field label={t("details.mobile")} value={resident.mobile ?? resident.phone ?? "—"} />
        </CardContent>
      </Card>
    </div>
  );
}

async function AssignmentsTab({ residentId, t }: { residentId: string; t: T }) {
  const supabase = await createClient();
  const assignments = await listAssignmentsByResident(residentId);

  const unitIds = Array.from(new Set(assignments.map((a) => a.unit_id)));
  const unitLabels: Record<string, string> = {};
  if (unitIds.length > 0) {
    const { data } = await supabase
      .from("units").select("id, unit_number").in("id", unitIds);
    for (const u of (data ?? []) as unknown as Array<{ id: string; unit_number: string }>) {
      unitLabels[u.id] = u.unit_number;
    }
  }

  if (assignments.length === 0) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground">
        {t("headers.resident_no_assignments")}
      </CardContent></Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("tables.unit")}</TableHead>
            <TableHead>{t("tables.type")}</TableHead>
            <TableHead>{t("tables.status")}</TableHead>
            <TableHead>{t("tables.start")}</TableHead>
            <TableHead>{t("tables.end")}</TableHead>
            <TableHead className="text-right">{t("tables.rent")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <Link href={`/units/${a.unit_id}`} className="font-medium hover:underline">
                  {unitLabels[a.unit_id] ?? a.unit_id.slice(0, 8)}
                </Link>
              </TableCell>
              <TableCell className="capitalize">{a.assignment_type}</TableCell>
              <TableCell><StatusBadge status={a.status} /></TableCell>
              <TableCell className="text-muted-foreground">{formatDate(a.start_date)}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(a.end_date)}</TableCell>
              <TableCell className="text-right tabular-nums">{a.monthly_rent ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

async function DocumentsTab({ residentId }: { residentId: string }) {
  const docs = await listDocuments({ entityType: "resident", entityId: residentId });
  return (
    <DocumentSection
      entityType="resident"
      entityId={residentId}
      documents={docs}
    />
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
