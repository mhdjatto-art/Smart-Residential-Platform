import { History } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { listAuditEntries } from "@/lib/api/analytics";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ table?: string; action?: string }> }) {
  const sp = await searchParams;
  const entries = await listAuditEntries({ table: sp.table, action: sp.action, limit: 300 });
  return (
    <div>
      <PageHeader
        title="Audit log"
        titleKey="headers.audit_log_title"
        description="Immutable record of every change across the platform. Useful for compliance and forensics."
        descKey="headers.audit_log_desc"
      />
      {entries.length === 0 ? (
        <EmptyState icon={History} title="No audit entries" description="Activity logs will appear here as the system runs." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Row</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">{e.actor_id?.slice(0, 8) ?? "system"}</TableCell>
                  <TableCell className="font-mono text-xs">{e.table_name}</TableCell>
                  <TableCell className="capitalize">{e.action}</TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">{e.row_id?.slice(0, 8) ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
