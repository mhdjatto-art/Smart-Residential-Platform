import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { listBuildings } from "@/lib/api/buildings";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BuildingsPage() {
  const buildings = await listBuildings();
  return (
    <div>
      <PageHeader title="Buildings" description="Buildings across your compounds." />
      {buildings.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No buildings yet"
          description="Add a compound first, then define the buildings inside it."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Floors</TableHead>
                <TableHead className="text-right">Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buildings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="text-muted-foreground">{b.code ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{b.floors ?? "—"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(b.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
