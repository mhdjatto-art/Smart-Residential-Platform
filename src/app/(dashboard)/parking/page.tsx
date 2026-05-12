import { Car } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { listParkingSpots, listParkingAssignments } from "@/lib/api/iot";

export const dynamic = "force-dynamic";

export default async function ParkingPage() {
  const [spots, assignments] = await Promise.all([listParkingSpots(), listParkingAssignments()]);
  const activeAssignmentsBySpot = new Map(
    assignments.filter((a) => a.status === "active").map((a) => [a.spot_id, a])
  );

  return (
    <div>
      <PageHeader
        title="Parking"
        titleKey="headers.parking_title"
        description="Parking spots and resident assignments."
        descKey="headers.parking_desc"
      />

      <Card>
        <CardHeader><CardTitle>Spots ({spots.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {spots.length === 0 ? (
            <EmptyState icon={Car} title="No parking spots configured" description="Add parking spots to your compound, then assign them to units." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Spot</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Assigned to (plate)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spots.map((s) => {
                  const assignment = activeAssignmentsBySpot.get(s.id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium font-mono">{s.spot_number}</TableCell>
                      <TableCell className="text-xs capitalize">{s.spot_kind}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {assignment ? assignment.vehicle_plate ?? "(assigned)" : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={assignment ? "occupied" : "vacant"} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Assignments ({assignments.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {assignments.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No assignments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Spot</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Plate</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono">{a.spot_number ?? a.spot_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[a.vehicle_make, a.vehicle_model].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{a.vehicle_plate ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(a.start_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.end_date ? new Date(a.end_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
