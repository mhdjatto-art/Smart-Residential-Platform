import Link from "next/link";
import { AlertOctagon, CalendarClock, DollarSign, Download, FileText, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { MonthlyChart } from "@/components/finance/monthly-chart";
import { AgingChart } from "@/components/finance/aging-chart";
import { getFinanceStats, listTopOverdue } from "@/lib/api/finance-stats";
import { getMonthlyChart, getAgingBuckets } from "@/lib/api/finance-charts";
import { requireRole, requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const user = await requireUser();

  const [stats, topOverdue, monthly, aging] = await Promise.all([
    getFinanceStats(),
    listTopOverdue(10),
    getMonthlyChart(),
    getAgingBuckets(),
  ]);

  // Pick the user's org default currency for chart display.
  let displayCurrency = "USD";
  if (user.organizationIds.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organizations")
      .select("currency")
      .eq("id", user.organizationIds[0])
      .maybeSingle();
    displayCurrency = (data as { currency?: string } | null)?.currency ?? "USD";
  }

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Collections, outstanding balances, overdue trackers, and analytics."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/api/exports/payments.csv?status=confirmed"><Download className="h-4 w-4" />Export</Link>
            </Button>
            <Button asChild><Link href="/payments/new"><DollarSign className="h-4 w-4" />Record payment</Link></Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total collected" value={formatCurrency(stats.total_collected, { currency: displayCurrency })} icon={Wallet} />
        <StatCard label="Outstanding" value={formatCurrency(stats.outstanding_balance, { currency: displayCurrency })} icon={FileText} />
        <StatCard
          label="Overdue"
          value={formatCurrency(stats.overdue_balance, { currency: displayCurrency })}
          icon={AlertOctagon}
        />
        <StatCard
          label="Collection rate"
          value={`${stats.collection_rate}%`}
          icon={TrendingUp}
          trend={{ value: stats.collection_rate >= 80 ? "healthy" : "needs attention", positive: stats.collection_rate >= 80 }}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active contracts" value={stats.active_contracts} icon={FileText} />
        <StatCard label="Monthly revenue (30d)" value={formatCurrency(stats.monthly_revenue, { currency: displayCurrency })} icon={DollarSign} />
        <StatCard label="Due in 30 days" value={formatCurrency(stats.upcoming_30d_amount, { currency: displayCurrency })} icon={CalendarClock} />
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly collections vs expected</CardTitle>
            <CardDescription>Rolling 12 months · {displayCurrency}</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyChart data={monthly} currency={displayCurrency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outstanding aging</CardTitle>
            <CardDescription>How long unpaid amounts have been outstanding</CardDescription>
          </CardHeader>
          <CardContent>
            <AgingChart data={aging} currency={displayCurrency} />
          </CardContent>
        </Card>
      </div>

      {/* Top overdue */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Top overdue contracts</CardTitle>
            <CardDescription>Highest unpaid balances first.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {topOverdue.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No overdue balances — everything is current.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract</TableHead>
                    <TableHead>Resident</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Since</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topOverdue.map((row) => (
                    <TableRow key={row.contract_id}>
                      <TableCell>
                        <Link href={`/contracts/${row.contract_id}`} className="font-mono font-medium hover:underline">
                          {row.contract_number}
                        </Link>
                      </TableCell>
                      <TableCell>{row.resident_name}</TableCell>
                      <TableCell className="font-mono">{row.unit_number}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(row.oldest_due_date)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-destructive">
                        {formatCurrency(row.overdue_amount, { currency: displayCurrency })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
