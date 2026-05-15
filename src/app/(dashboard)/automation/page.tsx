import Link from "next/link";
import { Plus, Workflow } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { AutomationRowActions } from "@/components/automation/automation-row-actions";
import { ExecuteRulesButton } from "@/components/automation/execute-rules-button";
import { listAutomationRules } from "@/lib/api/automation";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AutomationPage() {
  await requireCapability("automation:read");
  const rules = await listAutomationRules();
  return (
    <div>
      <PageHeader
        title="Automation"
        titleKey="headers.automation_title"
        description="Declarative rules that schedule jobs across the platform — reminders, escalations, suspensions, exports."
        descKey="headers.automation_desc"
        actions={
          <div className="flex gap-2">
            <ExecuteRulesButton />
            <Button asChild><Link href="/automation/new"><Plus className="h-4 w-4" />New rule</Link></Button>
          </div>
        }
      />
      {rules.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No automation rules yet"
          description="Create your first rule — e.g. 'daily 9am: send reminders for installments due in 7 days'."
          action={<Button asChild><Link href="/automation/new">New rule</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Runs</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-xs font-mono">{r.trigger_kind}</TableCell>
                  <TableCell className="text-xs font-mono">{r.action}</TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {r.run_count}
                    {r.failure_count > 0 && <span className="ml-1 text-xs text-rose-600">({r.failure_count} failed)</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.last_run_at ? new Date(r.last_run_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right"><AutomationRowActions id={r.id} status={r.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
