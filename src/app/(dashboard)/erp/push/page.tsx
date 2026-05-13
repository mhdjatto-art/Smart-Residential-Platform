import type { Metadata } from "next";
import { Calendar, Code2, Truck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RunPushWorkerButton } from "@/components/erp/run-push-worker-button";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ERP push worker" };
export const dynamic = "force-dynamic";

export default async function ErpPushPage() {
  await requireRole(["super_admin", "developer_admin", "finance_officer"]);
  const supabase = await createClient();

  // Count entries in each status
  const [queued, failed, posted, syncing] = await Promise.all([
    supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("status", "queued"),
    supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("status", "posted"),
    supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("status", "syncing"),
  ]);

  return (
    <div>
      <PageHeader
        title="ERP push worker"
        description="Pushes queued journal entries to Odoo / SAP / CSV via configured adapters. Runs every 15 minutes via cron, or manually below."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Queued"  value={queued.count  ?? 0} tone="amber" />
        <Stat label="Syncing" value={syncing.count ?? 0} tone="sky" />
        <Stat label="Posted"  value={posted.count  ?? 0} tone="emerald" />
        <Stat label="Failed"  value={failed.count  ?? 0} tone="rose" />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Manual trigger</CardTitle>
          <CardDescription>
            Pushes up to 20 queued entries per run via the matching adapter. Retries up to 5 times on failure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RunPushWorkerButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Schedule it</CardTitle>
          <CardDescription>Add to <code>vercel.json</code> for automatic pushes every 15 minutes.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-md bg-muted p-3 text-xs"><code>{`{
  "crons": [
    { "path": "/api/cron/billing-run",    "schedule": "0 1 * * *" },
    { "path": "/api/cron/send-reminders", "schedule": "0 9 * * *" },
    { "path": "/api/cron/erp-push",       "schedule": "*/15 * * * *" }
  ]
}`}</code></pre>
          <p className="mt-3 text-sm flex items-center gap-1.5">
            <Code2 className="h-4 w-4 text-muted-foreground" />
            Or call from anywhere: <code>GET /api/cron/erp-push</code> with <code>Bearer $CRON_SECRET</code> header.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "amber" | "sky" | "emerald" | "rose" }) {
  const styles = {
    amber:   "text-amber-600 dark:text-amber-400",
    sky:     "text-sky-600 dark:text-sky-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    rose:    "text-rose-600 dark:text-rose-400",
  } as const;
  return (
    <Card className="p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${styles[tone]}`}>{value}</p>
    </Card>
  );
}
