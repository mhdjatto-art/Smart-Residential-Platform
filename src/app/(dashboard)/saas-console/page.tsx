import Link from "next/link";
import { Building2, CreditCard, DollarSign, Sparkles, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { requireRole } from "@/lib/auth/guards";
import { getSaasOverview, listSubscriptions } from "@/lib/api/saas";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SaasConsolePage() {
  await requireRole(["super_admin"]);
  const [stats, subs] = await Promise.all([getSaasOverview(), listSubscriptions()]);

  return (
    <div>
      <PageHeader
        title="SaaS console"
        titleKey="headers.saas_console_title"
        description="Platform-wide tenant, plan, and revenue management. Super-admin only."
        descKey="headers.saas_console_desc"
        actions={
          <Button asChild>
            <Link href="/saas-console/organizations/new"><Sparkles className="h-4 w-4" />Provision tenant</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Organizations"          value={stats.total_organizations} icon={Building2} />
        <StatCard label="Active subscriptions"   value={stats.active_subscriptions} icon={Users} />
        <StatCard label="MRR estimate"           value={formatCurrency(stats.mrr_estimate, { currency: stats.currency })} icon={TrendingUp} />
        <StatCard label="ARR estimate"           value={formatCurrency(stats.arr_estimate, { currency: stats.currency })} icon={DollarSign} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Trialing tenants"   value={stats.trialing_subscriptions} icon={Sparkles} />
        <StatCard label="Unpaid invoices"    value={stats.unpaid_invoices} icon={CreditCard} />
        <StatCard label="Unpaid amount"      value={formatCurrency(stats.unpaid_amount, { currency: stats.currency })} icon={CreditCard} />
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tenants ({subs.length})</CardTitle>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link href="/saas-console/plans">Plans</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/saas-console/features">Features</Link></Button>
          </div>
        </CardHeader>
        <CardContent>
          {subs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tenants yet. Provision your first one.</p>
          ) : (
            <ul className="divide-y">
              {subs.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium font-mono text-xs">{s.organization_id.slice(0, 8)}…</p>
                    <p className="text-xs text-muted-foreground">{s.plan_name ?? s.plan_code ?? "—"} · {s.billing_cycle}</p>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                      s.status === "active"   ? "bg-emerald-100 text-emerald-700" :
                      s.status === "trialing" ? "bg-sky-100 text-sky-700" :
                      s.status === "past_due" ? "bg-amber-100 text-amber-700" :
                                                "bg-slate-100 text-slate-700"
                    }`}>{s.status}</span>
                    <p className="mt-0.5 text-xs tabular-nums">{formatCurrency(s.unit_price, { currency: s.currency })}/mo</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
