import { Activity } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { listIntegrationLogs } from "@/lib/api/pricing";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function IntegrationLogsPage() {
  await requireCapability("integrations:read");
  const logs = await listIntegrationLogs();
  return (
    <div>
      <PageHeader
        title="Integration logs"
        description="Every adapter call — successes, failures, latency."
      />
      {logs.length === 0 ? (
        <EmptyState icon={Activity} title="No integration activity yet" description="Logs will appear here as workers and webhooks talk to provider APIs." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="text-right">HTTP</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(l.occurred_at).toLocaleString()}</TableCell>
                  <TableCell className="text-xs font-mono">{l.action}</TableCell>
                  <TableCell><StatusBadge status={l.outcome} /></TableCell>
                  <TableCell className="text-right text-xs font-mono">{l.status_code ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{l.duration_ms != null ? `${l.duration_ms}ms` : "—"}</TableCell>
                  <TableCell className="text-xs text-rose-600 truncate max-w-md">{l.error_message ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
