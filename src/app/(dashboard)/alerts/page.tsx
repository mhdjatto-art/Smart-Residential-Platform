import { AlertOctagon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { AlertActions } from "@/components/control-center/alert-actions";
import { listAlerts } from "@/lib/api/analytics";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const alerts = await listAlerts(["open","acknowledged","snoozed","resolved"]);
  return (
    <div>
      <PageHeader title="Alerts" description="System-detected operational issues. Acknowledge or resolve when handled." />
      {alerts.length === 0 ? (
        <EmptyState icon={AlertOctagon} title="No alerts" description="Nothing operationally concerning right now." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                      a.severity === "critical" ? "bg-rose-100 text-rose-700" :
                      a.severity === "warning"  ? "bg-amber-100 text-amber-700" :
                                                   "bg-slate-100 text-slate-700"
                    }`}>{a.severity}</span>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{a.kind}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{a.title}</p>
                    {a.body && <p className="text-xs text-muted-foreground">{a.body}</p>}
                  </TableCell>
                  <TableCell className="capitalize text-sm">{a.status}</TableCell>
                  <TableCell className="text-right"><AlertActions id={a.id} status={a.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
