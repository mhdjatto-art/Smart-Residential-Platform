import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatusChanger, CommentBox } from "@/components/tickets/ticket-actions";
import { getTicket, listComments } from "@/lib/api/tickets";
import { requireUser, isStaff, requireCapability } from "@/lib/auth/guards";
import { formatDate, initials } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability("ticket:read");
  const { id } = await params;
  const user = await requireUser();
  const [ticket, comments] = await Promise.all([getTicket(id), listComments(id)]);
  if (!ticket) notFound();
  const { t } = await getT();

  const staff = isStaff(user);
  const visibleComments = staff ? comments : comments.filter((c) => !c.is_internal);

  return (
    <div>
      <PageHeader
        title={`${ticket.ticket_number} · ${ticket.subject}`}
        description={t("ops.ticket_opened_at", { date: formatDate(ticket.opened_at) ?? "" })}
        actions={
          <div className="flex gap-2 items-center">
            <Button asChild variant="outline">
              <Link href="/tickets"><ArrowLeft className="h-4 w-4" />{t("actions.back")}</Link>
            </Button>
            {staff && <StatusChanger ticketId={ticket.id} current={ticket.status} />}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="space-y-3 p-6">
              <div className="flex items-center gap-3">
                <StatusBadge status={ticket.status} />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {ticket.category} · {ticket.priority}
                </span>
              </div>
              <h2 className="text-xl font-semibold">{ticket.subject}</h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {t("ops.ticket_comments_title", { n: visibleComments.length })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {visibleComments.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("ops.ticket_no_comments")}</p>
              ) : (
                <ul className="space-y-4">
                  {visibleComments.map((c) => (
                    <li key={c.id} className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{initials(c.author_id?.slice(0, 2) ?? "??")}</AvatarFallback>
                      </Avatar>
                      <div className={`flex-1 rounded-md p-3 text-sm ${c.is_internal ? "border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30" : "bg-muted/40"}`}>
                        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                          <span>{c.is_internal ? t("ops.ticket_internal_note") : t("ops.ticket_comment")}</span>
                          <span>{formatDate(c.created_at)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t pt-4">
                <CommentBox ticketId={ticket.id} isStaff={staff} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>{t("ops.ticket_details_title")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label={t("ops.ticket_status")} value={<StatusBadge status={ticket.status} />} />
            <Row label={t("ops.ticket_priority")} value={<span className="capitalize">{ticket.priority}</span>} />
            <Row label={t("ops.ticket_category")} value={<span className="capitalize">{ticket.category}</span>} />
            <Row label={t("ops.ticket_sla_due")} value={formatDate(ticket.sla_due_date)} />
            <Row label={t("ops.ticket_assigned_to")} value={ticket.assigned_to ? <span className="font-mono text-xs">{ticket.assigned_to.slice(0, 8)}</span> : "—"} />
            <Row label={t("ops.ticket_assigned_at")} value={formatDate(ticket.assigned_at)} />
            <Row label={t("ops.ticket_resolved_at")} value={formatDate(ticket.resolved_at)} />
            <Row label={t("ops.ticket_closed_at")} value={formatDate(ticket.closed_at)} />
            {ticket.resolution_notes && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("ops.ticket_resolution")}</p>
                <p className="mt-1">{ticket.resolution_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
