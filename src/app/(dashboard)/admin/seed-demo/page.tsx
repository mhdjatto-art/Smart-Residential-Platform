import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SeedDemoButton } from "@/components/admin/seed-demo-button";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { DEMO_SEED_INFO } from "@/lib/seed/demo";

export const metadata: Metadata = { title: "Demo data seed" };
export const dynamic = "force-dynamic";

export default async function SeedDemoPage() {
  await requireRole(["super_admin", "developer_admin"]);
  const user = await requireUser();
  if (!user.isSuperAdmin) {
    redirect("/dashboard");
  }

  return (
    <div>
      <PageHeader
        title="Reset & seed demo data"
        description="Wipes all @bonyan.demo users and the Bonyan Demo Group organization, then recreates a complete demo environment with one user per role plus realistic business data."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Demo seed controller
            </CardTitle>
            <CardDescription>
              Super-admin only. Safe to run repeatedly — affects only the demo organization and
              auth users with <code>@{DEMO_SEED_INFO.domain}</code> emails.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SeedDemoButton />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users created</CardTitle>
            <CardDescription>
              All accounts will have the password <code>{DEMO_SEED_INFO.password}</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {DEMO_SEED_INFO.users.map((u) => (
                <li key={u.email} className="rounded-md border bg-muted/30 p-2">
                  <p className="font-mono text-xs">{u.email}</p>
                  <p className="text-muted-foreground">
                    {u.full_name} · <span className="font-medium">{u.role}</span>
                    {u.unit ? ` · ${u.unit}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>What gets seeded</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <li>• 1 organization (<code>Bonyan Demo Group</code>) + 1 compound (<code>Bonyan City Demo</code>)</li>
            <li>• 3 buildings (A, B, C) + 6 units</li>
            <li>• 12 auth users covering every role in the system</li>
            <li>• 6 residents linked to their auth accounts and units</li>
            <li>• 1 installment contract per resident (rental or sale) with auto-generated schedule</li>
            <li>• Payments recorded for half of the residents via <code>record_payment</code></li>
            <li>• 1 electricity utility bill per resident (paid / partial / issued mix)</li>
            <li>• 1 ticket per resident (open / in-progress / resolved mix)</li>
            <li>• 2 notifications per resident</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
