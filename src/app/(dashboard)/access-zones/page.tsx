import { DoorOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { listAccessZones } from "@/lib/api/iot";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AccessZonesPage() {
  await requireCapability("access:read");
  const zones = await listAccessZones();
  return (
    <div>
      <PageHeader
        title="Access zones"
        titleKey="headers.access_zones_title"
        description="Gates, doors, parkings, and amenities — controllable entry points."
        descKey="headers.access_zones_desc"
      />
      {zones.length === 0 ? (
        <EmptyState icon={DoorOpen} title="No zones configured" description="Define the gates and amenities you want to control." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Requires approval</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((z) => (
                <TableRow key={z.id}>
                  <TableCell className="font-medium">{z.name}</TableCell>
                  <TableCell className="text-xs font-mono">{z.zone_kind}</TableCell>
                  <TableCell className="text-xs">{z.requires_approval ? "Yes" : "No"}</TableCell>
                  <TableCell><StatusBadge status={z.is_active ? "active" : "inactive"} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
