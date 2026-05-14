import Link from "next/link";
import { AlertOctagon, Droplets, Flame, Gauge, Receipt, Repeat, Wallet, Wifi, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { getUtilityStats } from "@/lib/api/utility-stats";
import { requireRole, requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function UtilitiesPage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer", "maintenance_staff"]);
  const user = await requireUser();
  const stats = await getUtilityStats();

  let currency = "USD";
  const firstOrgId = user.organizationIds[0];
  if (firstOrgId) {
    const supabase = await createClient();
    const { data } = await supabase.from("organizations").select("currency").eq("id", firstOrgId).maybeSingle();
    currency = (data as { currency?: string } | null)?.currency ?? "USD";
  }

  return (
    <div>
      <PageHeader
        title="Utilities"
        description="Smart infrastructure overview — electricity, internet, gas, water."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active subscriptions" value={stats.active_subscriptions} icon={Repeat} />
        <StatCard label="Electricity subs" value={stats.electricity_subs} icon={Zap} />
        <StatCard label="Internet subs" value={stats.internet_subs} icon={Wifi} />
        <StatCard label="Gas orders (pending)" value={stats.gas_orders_pending} icon={Flame} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Unpaid bills" value={stats.unpaid_bills} icon={AlertOctagon}
          trend={stats.unpaid_bills > 0 ? { value: "needs collection", positive: false } : undefined} />
        <StatCard label="Outstanding" value={formatCurrency(stats.unpaid_amount, { currency })} icon={Receipt} />
        <StatCard label="Monthly revenue (30d)" value={formatCurrency(stats.monthly_utility_revenue, { currency })} icon={Wallet} />
        <StatCard label="Active meters" value={stats.active_meters} icon={Gauge} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Quick actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start"><Link href="/providers/new"><Zap className="h-4 w-4" />New provider</Link></Button>
            <Button asChild variant="outline" className="w-full justify-start"><Link href="/subscriptions/new"><Repeat className="h-4 w-4" />New subscription</Link></Button>
            <Button asChild variant="outline" className="w-full justify-start"><Link href="/meters/new"><Gauge className="h-4 w-4" />Register meter</Link></Button>
            <Button asChild variant="outline" className="w-full justify-start"><Link href="/internet-packages/new"><Wifi className="h-4 w-4" />New internet package</Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Electricity</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">Manage meters and record readings to generate consumption bills.</p>
            <Button asChild size="sm" variant="outline"><Link href="/meters">View meters</Link></Button>
            <Button asChild size="sm"><Link href="/utility-bills?utility_type=electricity">View bills</Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Droplets className="h-4 w-4" />Other utilities</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">Water, gas, generator, and recurring services.</p>
            <Button asChild size="sm" variant="outline"><Link href="/subscriptions">All subscriptions</Link></Button>
            <Button asChild size="sm"><Link href="/utility-bills">All utility bills</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
