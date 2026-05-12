import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { listMyNotifications } from "@/lib/api/notifications";
import { MarkAllReadButton, MarkOneReadButton } from "@/components/notifications/notification-actions";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const items = await listMyNotifications(false);
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : "You're all caught up"}
        actions={unread > 0 ? <MarkAllReadButton /> : undefined}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="You'll see updates here when there's activity on your tickets, bookings, or payments."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id} className={`flex items-start justify-between gap-4 px-6 py-4 ${!n.read_at ? "bg-muted/30" : ""}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {!n.read_at && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">{n.kind.replace("_", " ")}</span>
                      <span className="text-xs text-muted-foreground">· {formatDate(n.created_at)}</span>
                    </div>
                    <p className="mt-1 font-medium">{n.title}</p>
                    {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                    {n.href && (
                      <Button asChild variant="link" className="px-0 mt-1 h-auto">
                        <Link href={n.href}>Open →</Link>
                      </Button>
                    )}
                  </div>
                  {!n.read_at && <MarkOneReadButton id={n.id} />}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { Check };
