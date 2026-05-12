import { Home } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { listUnits } from "@/lib/api/units";

export const dynamic = "force-dynamic";

export default async function UnitsPage() {
  const units = await listUnits({ limit: 500 });
  return (
    <div>
      <PageHeader title="Units" description="All units in your compounds." />
      {units.length === 0 ? (
        <EmptyState
          icon={Home}
          title="No units yet"
          description="Once your buildings have units defined, they'll show up here."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Floor</TableHead>
                <TableHead>Bedrooms</TableHead>
                <TableHead>Bathrooms</TableHead>
                <TableHead className="text-right">Area (m²)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.unit_number}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{u.unit_type}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        u.status === "occupied" ? "success" : u.status === "vacant" ? "muted" : u.status === "maintenance" ? "warning" : "outline"
                      }
                    >
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.floor ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.bedrooms ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.bathrooms ?? "—"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{u.area_sqm ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
