import { Activity } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { listAccessLogs } from "@/lib/api/iot";

export const dynamic = "force-dynamic";

export default async function AccessLogsPage() {
  const logs = await listAccessLogs();
  return (
    <div>
      <PageHeader
        title="Access logs"
        titleKey="headers.access_logs_title"
        description="Every entry/exit attempt — granted, denied, or overridden."
        descKey="headers.access_logs_desc"
      />
      {logs.length === 0 ? (
        <EmptyState icon={Activity} title="No access events yet" description="Gates, locks, and QR scanners will log activity here as residents and visitors come and go." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Identifier / plate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(l.occurred_at).toLocaleString()}</TableCell>
                  <TableCell className="text-xs font-mono uppercase">{l.method}</TableCell>
                  <TableCell><StatusBadge status={l.outcome} /></TableCell>
                  <TableCell className="text-xs capitalize">{l.direction ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{l.vehicle_plate ?? l.identifier ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
