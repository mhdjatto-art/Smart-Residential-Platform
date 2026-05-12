import { Cpu } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { listDevices } from "@/lib/api/iot";

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  const devices = await listDevices();
  return (
    <div>
      <PageHeader
        title="Devices"
        titleKey="headers.devices_title"
        description="Every IoT device the platform tracks — smart meters, gates, locks, cameras, sensors."
        descKey="headers.devices_desc"
      />
      {devices.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No devices yet"
          description="Provision your first device from the integrations layer or add one manually."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Vendor / Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="text-xs font-mono">{d.device_kind}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{d.serial ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {d.vendor ?? "—"} {d.model ? `· ${d.model}` : ""}
                  </TableCell>
                  <TableCell><StatusBadge status={d.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
