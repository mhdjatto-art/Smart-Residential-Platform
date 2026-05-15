import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle, Building2, CalendarCheck, ClipboardList, Coins,
  Home, ShieldCheck, TrendingUp, UserPlus, Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RevenueChart } from "@/components/analytics/revenue-chart";
import { UtilityChart } from "@/components/analytics/utility-chart";
import { getAnalyticsData } from "@/lib/api/analytics-dashboard";
import { formatCurrency } from "@/lib/utils";
import { requireCapability } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const TICKET_COLORS: Record<string, string> = {
  open:        "bg-rose-500",
  assigned:    "bg-amber-500",
  in_progress: "bg-sky-500",
  pending:     "bg-violet-500",
  resolved:    "bg-emerald-500",
  closed:      "bg-slate-400",
};

export default async function AnalyticsPage() {
  await requireCapability("analytics:read");
  const a = await getAnalyticsData();
  const totalTickets = a.ticket_by_status.reduce((s, t) => s + t.count, 0);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Revenue, collections, occupancy, tickets, and consumption — last 6 months and live KPIs."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/analytics/risk"><AlertTriangle className="h-4 w-4" />Risk scoring</Link>
          </Button>
        }
      />

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard icon={Coins}         label="Revenue (30d)"     value={formatCurrency(a.kpis.total_revenue_30d)} tone="emerald" />
        <KpiCard icon={TrendingUp}    label="Collection rate"   value={`${a.kpis.collection_rate}%`}            tone={a.kpis.collection_rate >= 80 ? "emerald" : "amber"} />
        <KpiCard icon={Home}          label="Occupancy"         value={`${a.kpis.occupancy_rate}%`}             tone={a.kpis.occupancy_rate >= 70 ? "emerald" : "amber"} />
        <KpiCard icon={AlertTriangle} label="Overdue"           value={formatCurrency(a.kpis.overdue_amount)}   tone="rose" sub={`${a.kpis.overdue_count} installments`} />
        <KpiCard icon={Users}         label="Active residents"  value={String(a.kpis.active_residents)} />
        <KpiCard icon={ClipboardList} label="Active tickets"    value={String(a.kpis.active_tickets)}   tone={a.kpis.active_tickets > 0 ? "amber" : "default"} />
        <KpiCard icon={CalendarCheck} label="Pending bookings"  value={String(a.kpis.pending_bookings)} tone={a.kpis.pending_bookings > 0 ? "amber" : "default"} />
        <KpiCard icon={UserPlus}      label="Pending visitors"  value={String(a.kpis.pending_visitors)} tone={a.kpis.pending_visitors > 0 ? "amber" : "default"} />
      </div>

      {/* Revenue chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Coins className="h-4 w-4" /> Revenue · last 6 months</CardTitle>
          <CardDescription>Installments + utilities, confirmed payments only.</CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueChart data={a.monthly_revenue} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Top 5 payers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-emerald-600" />Top payers (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {a.top_payers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments in the last 30 days.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {a.top_payers.map((p, i) => (
                  <li key={i} className="flex items-center justify-between rounded-md border bg-muted/30 p-2">
                    <span className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-700">{i + 1}</span>
                      <span className="truncate">{p.resident_name}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{formatCurrency(p.total_paid, { currency: p.currency })}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Top 5 most overdue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-rose-600" />Most overdue</CardTitle>
          </CardHeader>
          <CardContent>
            {a.top_overdue.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overdue residents. ✓</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {a.top_overdue.map((r, i) => (
                  <li key={i} className="flex items-center justify-between rounded-md border bg-muted/30 p-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.resident_name}</p>
                      <p className="text-[10px] text-muted-foreground">{r.days_overdue}d overdue</p>
                    </div>
                    <span className="font-semibold tabular-nums text-rose-600">{formatCurrency(r.amount, { currency: r.currency })}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Tickets by status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4" />Tickets · {totalTickets}</CardTitle>
          </CardHeader>
          <CardContent>
            {totalTickets === 0 ? (
              <p className="text-sm text-muted-foreground">No tickets in the system.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {a.ticket_by_status.map((t) => {
                  const pct = Math.round((t.count / totalTickets) * 100);
                  return (
                    <li key={t.status}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="capitalize">{t.status.replace(/_/g, " ")}</span>
                        <span className="tabular-nums">{t.count} · {pct}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full ${TICKET_COLORS[t.status] ?? "bg-slate-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Utility consumption chart */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Utility consumption · last 6 months</CardTitle>
          <CardDescription>Total kWh + m³ across all units (from utility_bills.consumption).</CardDescription>
        </CardHeader>
        <CardContent>
          <UtilityChart data={a.utility_consumption} />
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, tone, sub,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tone?: "default" | "emerald" | "amber" | "rose";
  sub?: string;
}) {
  const styles: Record<NonNullable<typeof tone>, string> = {
    default: "",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber:   "text-amber-600 dark:text-amber-400",
    rose:    "text-rose-600 dark:text-rose-400",
  };
  const cls = styles[tone ?? "default"];
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-4 w-4 ${cls}`} />
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-1 text-xl font-bold tabular-nums ${cls}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </Card>
  );
}
