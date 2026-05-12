import { Crown } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { listPlans } from "@/lib/api/saas";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  await requireRole(["super_admin"]);
  const plans = await listPlans();
  return (
    <div>
      <PageHeader title="Subscription plans" description="Plan catalog. Quotas null = unlimited." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => (
          <Card key={p.id} className={p.tier === "enterprise" ? "border-emerald-500/40" : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {p.name}
                {p.tier === "enterprise" && <Crown className="h-4 w-4 text-amber-500" />}
              </CardTitle>
              <p className="text-xs text-muted-foreground capitalize">{p.tier} · {p.code}</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-2xl font-bold tabular-nums">{formatCurrency(p.monthly_price, { currency: p.currency })}<span className="text-xs font-normal text-muted-foreground"> / month</span></p>
                <p className="text-xs text-muted-foreground">{formatCurrency(p.annual_price, { currency: p.currency })} / year</p>
              </div>
              {p.description && <p className="text-muted-foreground">{p.description}</p>}
              <dl className="grid grid-cols-2 gap-1 text-[11px]">
                <dt className="text-muted-foreground">Compounds</dt><dd className="tabular-nums">{p.max_compounds ?? "∞"}</dd>
                <dt className="text-muted-foreground">Units</dt>     <dd className="tabular-nums">{p.max_units ?? "∞"}</dd>
                <dt className="text-muted-foreground">Residents</dt> <dd className="tabular-nums">{p.max_residents ?? "∞"}</dd>
                <dt className="text-muted-foreground">Admins</dt>    <dd className="tabular-nums">{p.max_admin_users ?? "∞"}</dd>
                <dt className="text-muted-foreground">Storage</dt>   <dd className="tabular-nums">{p.max_storage_mb ? `${p.max_storage_mb} MB` : "∞"}</dd>
                <dt className="text-muted-foreground">API calls/mo</dt><dd className="tabular-nums">{p.max_api_calls_per_month?.toLocaleString() ?? "∞"}</dd>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
