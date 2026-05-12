import Link from "next/link";
import { AlertOctagon, Bell, CalendarDays, ClipboardList, Tag, UserPlus, Wrench } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getOperationsStats } from "@/lib/api/operations-stats";
import { listTicketsPaged } from "@/lib/api/tickets";
import { listVisitorsPaged } from "@/lib/api/visitors";
import { requireRole } from "@/lib/auth/guards";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "maintenance_staff", "security_staff"]);

  const [stats, recentTickets, recentVisitors] = await Promise.all([
    getOperationsStats(),
    listTicketsPaged({ pageSize: 5 }),
    listVisitorsPaged({ status: "pending", pageSize: 5 }),
  ]);

  return (
    <div>
      <PageHeader
        title="Operations"
        description="Real-time view of tickets, maintenance, visitors, and bookings."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="/tickets/new">New ticket</Link></Button>
            <Button asChild><Link href="/maintenance/new">New job</Link></Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open tickets" value={stats.open_tickets} icon={Tag} />
        <StatCard label="Urgent" value={stats.urgent_tickets} icon={AlertOctagon} trend={stats.urgent_tickets > 0 ? { value: "needs attention", positive: false } : undefined} />
        <StatCard label="SLA breaches" value={stats.sla_breaches} icon={ClipboardList} trend={stats.sla_breaches > 0 ? { value: "overdue", positive: false } : undefined} />
        <StatCard label="Active jobs" value={stats.active_jobs} icon={Wrench} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Visitors today" value={stats.visitors_today} icon={UserPlus} />
        <StatCard label="Pending visitors" value={stats.pending_visitors} icon={Bell} />
        <StatCard label="Pending bookings" value={stats.pending_bookings} icon={CalendarDays} />
        <StatCard label="Active technicians" value={stats.active_technicians} icon={Wrench} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent tickets</CardTitle>
            <Button asChild variant="outline" size="sm"><Link href="/tickets">View all</Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentTickets.data.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No tickets.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTickets.data.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Link href={`/tickets/${t.id}`} className="font-mono hover:underline">{t.ticket_number}</Link>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{t.subject}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{t.priority}</TableCell>
                      <TableCell><StatusBadge status={t.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pending visitors</CardTitle>
            <Button asChild variant="outline" size="sm"><Link href="/visitors">View all</Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentVisitors.data.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No pending visitors.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pass</TableHead>
                    <TableHead>Visitor</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentVisitors.data.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <Link href={`/visitors/${v.id}`} className="font-mono hover:underline">{v.pass_code}</Link>
                      </TableCell>
                      <TableCell className="text-sm">{v.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(v.scheduled_date)}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{v.visitor_type}</TableCell>
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
