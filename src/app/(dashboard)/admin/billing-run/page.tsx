import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Calendar, Code2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BillingRunController } from "@/components/admin/billing-run-controller";
import { requireUser, requireCapability } from "@/lib/auth/guards";
import { previewDueSubscriptions } from "@/lib/api/billing-run";

export const metadata: Metadata = { title: "Auto-billing run" };
export const dynamic = "force-dynamic";

export default async function BillingRunPage() {
  await requireCapability("payment:write");
  const user = await requireUser();
  const allowed = user.isSuperAdmin || user.roles.some((r) => ["developer_admin", "finance_officer"].includes(r.role));
  if (!allowed) redirect("/dashboard");

  const due = await previewDueSubscriptions();

  return (
    <div>
      <PageHeader
        title="Auto-billing run"
        description="Trigger the bill generator manually or schedule it to run daily. Reads utility_subscriptions, writes utility_bills."
      />

      <BillingRunController initialDue={due} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Schedule it to run daily
          </CardTitle>
          <CardDescription>
            Pick one of these options to make billing fully automatic.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="font-medium">Option A — Vercel Cron (recommended)</p>
            <p className="text-muted-foreground">
              Add this to <code>vercel.json</code>:
            </p>
            <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 text-xs"><code>{`{
  "crons": [{
    "path": "/api/cron/billing-run",
    "schedule": "0 1 * * *"
  }]
}`}</code></pre>
            <p className="mt-1 text-xs text-muted-foreground">Runs daily at 01:00 UTC. The endpoint is already wired up below.</p>
          </div>

          <div>
            <p className="font-medium">Option B — Supabase pg_cron (in-database)</p>
            <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 text-xs"><code>{`select cron.schedule(
  'srp-auto-billing',
  '0 1 * * *',
  $$ select public.generate_due_utility_bills(false); $$
);`}</code></pre>
            <p className="mt-1 text-xs text-muted-foreground">Requires pg_cron extension enabled in your project.</p>
          </div>

          <div>
            <p className="font-medium flex items-center gap-2"><Code2 className="h-4 w-4" /> Direct SQL call</p>
            <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 text-xs"><code>{`select public.generate_due_utility_bills(false);`}</code></pre>
            <p className="mt-1 text-xs text-muted-foreground">
              Useful for testing in Supabase SQL Editor. Pass <code>true</code> for a dry run.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
