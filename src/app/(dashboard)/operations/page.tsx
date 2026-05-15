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
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "maintenance_staff", "security_staff"]);

  const [stats, recentTickets, recentVisitors] = await Promise.all([
    getOperationsStats(),
    listTicketsPaged({ pageSize: 5 }),
    listVisitorsPaged({ status: "pending", pageSize: 5 }),
  ]);
  const { t } = await getT();

  return (
    <div>
      <PageHeader
        titleKey="headers.operations_title"
        descKey="headers.operations_desc"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="/tickets/new">{t("actions.new_ticket")}</Link></Button>
            <Button asChild><Link href="/maintenance/new">{t("actions.new_job")}</Link></Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("stats.open_tickets")} value={stats.open_tickets} icon={Tag} />
        <StatCard label={t("stats.urgent")} value={stats.urgent_tickets} icon={AlertOctagon} trend={stats.urgent_tickets > 0 ? { value: t("stats.needs_attention"), positive: false } : undefined} />
        <StatCard label={t("stats.sla_breaches")} value={stats.sla_breaches} icon={ClipboardList} trend={stats.sla_breaches > 0 ? { value: t("status.overdue"), positive: false } : undefined} />
        <StatCard label={t("stats.active_jobs")} value={stats.active_jobs} icon={Wrench} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("stats.visitors_today")} value={stats.visitors_today} icon={UserPlus} />
        <StatCard label={t("stats.pending_visitors")} value={stats.pending_visitors} icon={Bell} />
        <StatCard label={t("stats.pending_bookings")} value={stats.pending_bookings} icon={CalendarDays} />
        <StatCard label={t("stats.active_technicians")} value={stats.active_technicians} icon={Wrench} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("headers.recent_tickets_title")}</CardTitle>
            <Button asChild variant="outline" size="sm"><Link href="/tickets">{t("actions.view_all")}</Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentTickets.data.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t("headers.no_tickets")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("tables.ticket_number")}</TableHead>
                    <TableHead>{t("tables.subject")}</TableHead>
                    <TableHead>{t("tables.priority")}</TableHead>
                    <TableHead>{t("tables.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTickets.data.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell>
                        <Link href={`/tickets/${ticket.id}`} className="font-mono hover:underline">{ticket.ticket_number}</Link>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{ticket.subject}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{ticket.priority}</TableCell>
                      <TableCell><StatusBadge status={ticket.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("headers.pending_visitors_title")}</CardTitle>
            <Button asChild variant="outline" size="sm"><Link href="/visitors">{t("actions.view_all")}</Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentVisitors.data.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t("headers.no_pending_visitors")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("tables.pass")}</TableHead>
                    <TableHead>{t("tables.visitor")}</TableHead>
                    <TableHead>{t("tables.date")}</TableHead>
                    <TableHead>{t("tables.type")}</TableHead>
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
