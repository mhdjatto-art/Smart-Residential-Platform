import Link from "next/link";
import { Plus, Wrench } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { listTechnicians } from "@/lib/api/technicians";
import { requireRole } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function TechniciansPage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "maintenance_staff"]);
  const techs = await listTechnicians();

  return (
    <div>
      <PageHeader
        title="Technicians"
        description="Maintenance staff profiles and assignments."
        actions={<Button asChild><Link href="/technicians/new"><Plus className="h-4 w-4" />Add technician</Link></Button>}
      />

      {techs.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No technicians yet"
          description="Add technicians to assign maintenance jobs."
          action={<Button asChild><Link href="/technicians/new">Add technician</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Specialization</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {techs.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.mobile ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.specialization.length === 0 ? <span className="text-muted-foreground">—</span> :
                        t.specialization.map((s) => <Badge key={s} variant="muted">{s}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={t.availability_status} /></TableCell>
                  <TableCell>{t.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Inactive</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
