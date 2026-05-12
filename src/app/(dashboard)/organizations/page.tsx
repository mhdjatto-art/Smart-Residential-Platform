import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { listOrganizations } from "@/lib/api/organizations";
import { requireRole } from "@/lib/auth/guards";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrganizationsPage() {
  await requireRole(["developer_admin"]);
  const orgs = await listOrganizations();
  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Developers and property management companies on the platform."
      />
      {orgs.length === 0 ? (
        <EmptyState icon={Boxes} title="No organizations" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{o.slug}</TableCell>
                  <TableCell className="text-muted-foreground">{o.contact_email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={o.status === "active" ? "success" : "muted"}>{o.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(o.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
