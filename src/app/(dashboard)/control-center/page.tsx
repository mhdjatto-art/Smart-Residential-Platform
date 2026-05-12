import Link from "next/link";
import {
  Activity, AlertOctagon, BadgePercent, Building2, ClipboardList, Gauge,
  Receipt, ShoppingBag, Sparkles, TrendingDown, TrendingUp, Users, Wallet, Zap,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { ExecutiveTrendChart } from "@/components/control-center/executive-trend-chart";
import { RefreshSnapshotButton } from "@/components/control-center/refresh-snapshot-button";
import { getExecutiveSnapshot, listAlerts, listOverdueRisk } from "@/lib/api/analytics";
import { requireRole } from "@/lib/auth/guards";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

function delta(curr: number, prev: number | null | undefined): { value: string; positive: boolean } | undefined {
  if (prev == null) return undefined;
  const diff = curr - prev;
  if (diff === 0) return undefined;
  const sign = diff > 0 ? "+" : "";
  return { value: `${sign}${diff.toFixed(0)}`, positive: diff >= 0 };
}

export default async function ControlCenterPage() {
  await requireRole(["super_admin","developer_admin","compound_manager","finance_officer"]);
  const [snap, openAlerts, risks] = await Promise.all([
    getExecutiveSnapshot(),
    listAlerts(["open"]),
    listOverdueRisk(),
  ]);

  const k = snap.latest;
  const p = snap.prior;
  const currency = snap.currency;

  return (
    <div>
      <PageHeader
        title="Control Center"
        description={k
          ? `Snapshot as of ${new Date(k.computed_at).toLocaleString()}`
          : "No snapshot yet — refresh to compute."}
        actions={<RefreshSnapshotButton hasData={!!k} />}
      />

      {!k ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="mt-3 font-semibold">No analytics snapshot for today</p>
            <p className="mt-1 text-sm text-muted-foreground">Click &quot;Refresh now&quot; to compute one for your organization.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Outstanding" value={formatCurrency(k.outstanding_balance, { currency })} icon={Wallet}
                      trend={delta(k.outstanding_balance, p?.outstanding_balance)} />
            <StatCard label="Overdue" value={formatCurrency(k.overdue_amount, { currency })} icon={AlertOctagon}
                      trend={delta(k.overdue_amount, p?.overdue_amount)} />
            <StatCard label="Collections MTD" value={formatCurrency(k.collections_mtd, { currency })} icon={TrendingUp}
                      trend={delta(k.collections_mtd, p?.collections_mtd)} />
            <StatCard label="Occupancy" value={`${k.occupancy_rate.toFixed(1)}%`} icon={Building2}
                      trend={delta(k.occupancy_rate, p?.occupancy_rate)} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Active residents" value={k.active_residents} icon={Users} />
            <StatCard label="Active tickets" value={k.active_tickets} icon={ClipboardList} />
            <StatCard label="SLA breached" value={k.sla_breached} icon={TrendingDown} />
            <StatCard label="Unpaid utility bills" value={k.utility_bills_unpaid} icon={Zap} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Marketplace open" value={k.marketplace_orders_open} icon={ShoppingBag} />
            <StatCard label="Marketplace revenue (today)" value={formatCurrency(k.marketplace_revenue_today, { currency })} icon={Receipt} />
            <StatCard label="Marketplace commission (today)" value={formatCurrency(k.marketplace_commission_today, { currency })} icon={BadgePercent} />
            <StatCard label="Satisfaction" value={k.satisfaction_avg.toFixed(2)} icon={Gauge} />
          </div>

          <Card className="mt-6">
            <CardHeader><CardTitle>30-day trend</CardTitle></CardHeader>
            <CardContent>
              <ExecutiveTrendChart data={snap.trend_days} currency={currency} />
            </CardContent>
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2"><AlertOctagon className="h-4 w-4" />Open alerts ({openAlerts.length})</CardTitle>
                <Button asChild size="sm" variant="ghost"><Link href="/alerts">View all</Link></Button>
              </CardHeader>
              <CardContent>
                {openAlerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All clear.</p>
                ) : (
                  <ul className="space-y-2">
                    {openAlerts.slice(0, 6).map((a) => (
                      <li key={a.id} className="rounded-md border p-2 text-sm flex justify-between gap-2">
                        <div>
                          <p className="font-medium">{a.title}</p>
                          {a.body && <p className="text-xs text-muted-foreground">{a.body}</p>}
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                          a.severity === "critical" ? "bg-rose-100 text-rose-700" :
                          a.severity === "warning"  ? "bg-amber-100 text-amber-700" :
                                                       "bg-slate-100 text-slate-700"
                        }`}>{a.severity}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" />Overdue risk (AI)</CardTitle>
                <Button asChild size="sm" variant="ghost"><Link href="/analytics/risk">View all</Link></Button>
              </CardHeader>
              <CardContent>
                {risks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No risk scores yet. Recompute to populate.</p>
                ) : (
                  <ul className="space-y-2">
                    {risks.slice(0, 6).map((r) => (
                      <li key={r.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                        <div>
                          <p className="font-medium">{r.resident_name ?? r.subject_id.slice(0, 8)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Score {(r.score * 100).toFixed(0)} · {r.band}
                          </p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                          r.band === "critical" ? "bg-rose-100 text-rose-700" :
                          r.band === "high"     ? "bg-orange-100 text-orange-700" :
                          r.band === "medium"   ? "bg-amber-100 text-amber-700" :
                                                  "bg-emerald-100 text-emerald-700"
                        }`}>{r.band}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
