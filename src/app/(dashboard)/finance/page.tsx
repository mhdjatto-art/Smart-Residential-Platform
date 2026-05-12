import Link from "next/link";
import { AlertOctagon, CalendarClock, DollarSign, FileText, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { getFinanceStats, listTopOverdue } from "@/lib/api/finance-stats";
import { requireRole } from "@/lib/auth/guards";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);

  const [stats, topOverdue] = await Promise.all([
    getFinanceStats(),
    listTopOverdue(10),
  ]);

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Collections, outstanding balances, and overdue trackers."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="/contracts">Contracts</Link></Button>
            <Button asChild><Link href="/payments/new"><DollarSign className="h-4 w-4" />Record payment</Link></Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total collected" value={formatCurrency(stats.total_collected)} icon={Wallet} />
        <StatCard label="Outstanding" value={formatCurrency(stats.outstanding_balance)} icon={FileText} />
        <StatCard
          label="Overdue"
          value={formatCurrency(stats.overdue_balance)}
          icon={AlertOctagon}
          trend={{ value: `${stats.overdue_residents} contract(s)`, positive: false }}
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
        <StatCard label="Monthly revenue (30d)" value={formatCurrency(stats.monthly_revenue)} icon={DollarSign} />
        <StatCard label="Due in 30 days" value={formatCurrency(stats.upcoming_30d_amount)} icon={CalendarClock} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top overdue contracts</CardTitle>
            <p className="text-sm text-muted-foreground">Highest unpaid balances first. Click a contract to take action.</p>
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
                        {formatCurrency(row.overdue_amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quick actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full justify-start" variant="outline">
              <Link href="/contracts/new"><FileText className="h-4 w-4" />New contract</Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline">
              <Link href="/payments/new"><DollarSign className="h-4 w-4" />Record payment</Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline">
              <Link href="/payments">View all payments</Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline">
              <Link href="/contracts">View all contracts</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
