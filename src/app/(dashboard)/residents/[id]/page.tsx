import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getResident } from "@/lib/api/residents";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ResidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resident = await getResident(id);
  if (!resident) notFound();

  return (
    <div>
      <PageHeader
        title={`${resident.first_name} ${resident.last_name}`}
        description={resident.email ?? "Resident profile"}
        actions={
          <Button asChild variant="outline">
            <Link href="/residents">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-y-4 text-sm">
            <Field label="First name" value={resident.first_name} />
            <Field label="Last name" value={resident.last_name} />
            <Field label="Email" value={resident.email ?? "—"} />
            <Field label="Phone" value={resident.phone ?? "—"} />
            <Field
              label="Tenancy"
              value={<span className="capitalize">{resident.tenancy_type.replace("_", " ")}</span>}
            />
            <Field
              label="Status"
              value={
                <Badge variant={resident.status === "active" ? "success" : resident.status === "former" ? "muted" : "warning"}>
                  {resident.status}
                </Badge>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenancy</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-y-4 text-sm">
            <Field label="Move-in" value={formatDate(resident.move_in_date)} />
            <Field label="Move-out" value={formatDate(resident.move_out_date)} />
            <Field label="Added" value={formatDate(resident.created_at)} />
            <Field label="Last updated" value={formatDate(resident.updated_at)} />
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
