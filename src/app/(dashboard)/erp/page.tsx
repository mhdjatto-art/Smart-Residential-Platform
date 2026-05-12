import Link from "next/link";
import { Cable, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { listErpIntegrations } from "@/lib/api/erp";

export const dynamic = "force-dynamic";

export default async function ErpPage() {
  const integrations = await listErpIntegrations();
  return (
    <div>
      <PageHeader
        title="ERP integrations"
        titleKey="headers.erp_title"
        description="Connect SRP to your accounting system (Odoo, SAP, QuickBooks, …) — payments and bills push as journal entries automatically."
        descKey="headers.erp_desc"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link href="/erp/mappings">Account mappings</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/erp/entries">Journal entries</Link></Button>
            <Button asChild><Link href="/erp/new"><Plus className="h-4 w-4" />New integration</Link></Button>
          </div>
        }
      />
      {integrations.length === 0 ? (
        <EmptyState
          icon={Cable}
          title="No ERP connected yet"
          description="Connect Odoo, SAP, or use CSV export. SRP will push journal entries on every confirmed payment."
          action={<Button asChild><Link href="/erp/new">Connect ERP</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Auto-push</TableHead>
                <TableHead>Last sync</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell className="text-xs font-mono uppercase">{i.kind}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono truncate max-w-xs">{i.base_url ?? "—"}</TableCell>
                  <TableCell className="text-xs">{i.auto_push ? "Yes" : "No"}</TableCell>
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
