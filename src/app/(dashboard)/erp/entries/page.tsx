import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { listJournalEntries } from "@/lib/api/erp";
import { formatCurrency } from "@/lib/utils";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function JournalEntriesPage() {
  await requireCapability("erp:read");
  const entries = await listJournalEntries();
  return (
    <div>
      <PageHeader
        title="Journal entries"
        description="Every journal entry SRP has generated — what was pushed, what's pending, and what failed."
      />
      {entries.length === 0 ? (
        <EmptyState icon={BookOpen} title="No journal entries yet" description="As payments are confirmed and bills are issued, SRP will generate journal entries here." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>ERP id</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.entry_number}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(e.entry_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs">{e.reference ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground capitalize">{e.source_table ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(e.total_amount, { currency: e.currency })}</TableCell>
                  <TableCell className="text-xs font-mono">{e.external_journal_id ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
