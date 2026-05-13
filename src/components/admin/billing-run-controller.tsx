"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FlaskConical, Loader2, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { runAutoBilling, type BillingRunSummary, type SubscriptionsDueRow } from "@/lib/api/billing-run";

interface BillingRunControllerProps {
  initialDue: SubscriptionsDueRow[];
}

export function BillingRunController({ initialDue }: BillingRunControllerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<BillingRunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(dryRun: boolean) {
    setError(null);
    if (!dryRun && initialDue.length === 0) {
      toast.message("Nothing to bill today");
      return;
    }
    if (!dryRun && !confirm(`Generate ${initialDue.length} bills now? This will write to utility_bills.`)) return;

    startTransition(async () => {
      try {
        const s = await runAutoBilling(dryRun);
        setSummary(s);
        const verb = dryRun ? "Preview" : "Run";
        toast.success(`${verb} complete`, {
          description: `${s.generated} generated · ${s.skipped} skipped · ${s.errors} errors`,
        });
        if (!dryRun) router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        toast.error("Billing run failed", { description: msg });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Preview of subscriptions due today */}
      <Card>
        <CardHeader>
          <CardTitle>Due today ({initialDue.length})</CardTitle>
          <CardDescription>
            Subscriptions whose <code>next_billing_date</code> is today or earlier. Running the engine will
            generate a bill for each, advance the date to the next cycle, and stamp <code>last_billed_at</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initialDue.length === 0 ? (
            <p className="rounded-md border bg-emerald-50 p-4 text-center text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              ✓ Nothing to bill. All subscriptions are up to date.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Due since</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialDue.slice(0, 50).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.unit_number ?? "—"}</TableCell>
                      <TableCell className="capitalize">{r.subscription_type}</TableCell>
                      <TableCell className="text-muted-foreground">{r.provider_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.next_billing_date ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.monthly_fee.toLocaleString()} {r.currency}
                      </TableCell>
                    </TableRow>
                  ))}
                  {initialDue.length > 50 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-muted-foreground">
                        … and {initialDue.length - 50} more
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run(true)} disabled={pending} variant="outline">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
          Dry-run (preview, no writes)
        </Button>
        <Button onClick={() => run(false)} disabled={pending || initialDue.length === 0}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Generate {initialDue.length} bills now
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>
              {summary.dry_run ? "Dry-run result" : "Run complete"} — {summary.date}
            </CardTitle>
            <CardDescription>
              {summary.generated} generated · {summary.skipped} skipped · {summary.errors} errors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              <StatBox tone="emerald" icon={CheckCircle2} label="Generated" value={summary.generated} />
              <StatBox tone="amber"   icon={AlertTriangle} label="Skipped"   value={summary.skipped} />
              <StatBox tone="rose"    icon={XCircle}       label="Errors"    value={summary.errors} />
            </div>

            {summary.details.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium">View details ({summary.details.length})</summary>
                <div className="mt-2 max-h-96 overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-xs">
                  {summary.details.map((d, i) => (
                    <div key={i} className={
                      d.outcome === "generated"      ? "text-emerald-700 dark:text-emerald-300" :
                      d.outcome === "skipped_duplicate" ? "text-amber-700 dark:text-amber-300" :
                      "text-rose-700 dark:text-rose-300"
                    }>
                      {d.outcome === "generated" && `✓ ${d.bill_number} — ${d.provider} — ${d.total} ${d.currency} (${d.period_start} → ${d.period_end})`}
                      {d.outcome === "skipped_duplicate" && `↺ skipped (already billed for ${d.period_start})`}
                      {d.outcome === "error" && `✗ ERROR: ${d.message}`}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatBox({
  tone, icon: Icon, label, value,
}: {
  tone: "emerald" | "amber" | "rose";
  icon: typeof CheckCircle2;
  label: string;
  value: number;
}) {
  const styles: Record<typeof tone, string> = {
    emerald: "border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    amber:   "border-amber-500/40 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
    rose:    "border-rose-500/40 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
  };
  return (
    <div className={`rounded-md border p-3 ${styles[tone]}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-4 w-4" />
        <p className="text-[11px] uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
