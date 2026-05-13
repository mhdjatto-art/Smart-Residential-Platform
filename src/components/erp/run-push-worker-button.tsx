"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { runErpPushWorker } from "@/lib/api/erp-worker-action";
import type { PushRunSummary } from "@/lib/erp/worker";

export function RunPushWorkerButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<PushRunSummary | null>(null);

  function run() {
    if (!confirm("Push all queued journal entries to their configured ERPs now?")) return;
    startTransition(async () => {
      try {
        const s = await runErpPushWorker();
        setSummary(s);
        toast.success("Push complete", {
          description: `${s.posted} posted · ${s.failed} failed · ${s.skipped} skipped`,
        });
        router.refresh();
      } catch (err) {
        toast.error("Push failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  return (
    <div className="space-y-4">
      <Button onClick={run} disabled={pending} size="lg">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {pending ? "Pushing…" : "Run push worker now"}
      </Button>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Last run result</CardTitle>
            <CardDescription>
              {summary.picked} picked · {summary.posted} posted · {summary.failed} failed · {summary.skipped} skipped
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.details.length === 0 ? (
              <p className="text-sm text-muted-foreground">No queued entries to push.</p>
            ) : (
              <ul className="max-h-96 overflow-auto rounded-md border bg-muted/20 p-2 font-mono text-xs">
                {summary.details.map((d, i) => {
                  const icon =
                    d.outcome === "posted" ? <CheckCircle2 className="inline h-3.5 w-3.5 text-emerald-600" /> :
                    d.outcome === "failed" ? <XCircle className="inline h-3.5 w-3.5 text-rose-600" /> :
                    null;
                  return (
                    <li key={i} className={
                      d.outcome === "posted" ? "text-emerald-700 dark:text-emerald-300" :
                      d.outcome === "failed" ? "text-rose-700 dark:text-rose-300" :
                      "text-amber-700 dark:text-amber-300"
                    }>
                      {icon} <strong>{d.entry_number}</strong> · {d.outcome}
                      {d.external_id && ` → ${d.external_id}`}
                      {d.error && ` · ${d.error}`}
                      {d.duration_ms && ` (${d.duration_ms}ms)`}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
