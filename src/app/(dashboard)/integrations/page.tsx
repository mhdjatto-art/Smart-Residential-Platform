import Link from "next/link";
import { Cable, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { listIntegrations } from "@/lib/api/pricing";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const integrations = await listIntegrations();
  return (
    <div>
      <PageHeader
        title="Provider integrations"
        titleKey="headers.integrations_title"
        description="Adapter configurations for utility providers — Mikrotik, UniFi, Modbus, RADIUS, REST APIs."
        descKey="headers.integrations_desc"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link href="/integrations/logs">View logs</Link></Button>
            <Button asChild><Link href="/integrations/new"><Plus className="h-4 w-4" />New integration</Link></Button>
          </div>
        }
      />
      {integrations.length === 0 ? (
        <EmptyState
          icon={Cable}
          title="No integrations configured"
          description="Connect a Mikrotik router, UniFi controller, or any REST API to automate utility operations."
          action={<Button asChild><Link href="/integrations/new">New integration</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Adapter</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Last sync</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell className="text-xs font-mono uppercase">{i.adapter_kind}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono truncate max-w-xs">{i.endpoint_url ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{i.last_synced_at ? new Date(i.last_synced_at).toLocaleString() : "—"}</TableCell>
                  <TableCell><StatusBadge status={i.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
