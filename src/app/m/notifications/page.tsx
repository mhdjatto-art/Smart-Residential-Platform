import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { MobileTopbar } from "@/components/mobile/topbar";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { listMyNotifications, markAllRead } from "@/lib/api/notifications";

export const dynamic = "force-dynamic";

export default async function MobileNotificationsPage() {
  const ctx = await getResidentContext();
  const items = await listMyNotifications();
  const unread = items.filter((n) => !n.read_at).length;

  async function doMarkAll() {
    "use server";
    await markAllRead();
  }

  return (
    <div>
      <MobileTopbar title="Notifications" userId={ctx.user_id} unread={unread} showBack />
      <div className="p-4">
        {unread > 0 && (
          <form action={doMarkAll}>
            <button type="submit" className="mb-3 flex items-center gap-1 text-xs text-emerald-600 hover:underline">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </form>
        )}

        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Bell className="mx-auto h-8 w-8 opacity-50" />
            <p className="mt-2">No notifications yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => {
              const isUnread = !n.read_at;
              const body = (
                <div className={`rounded-xl border p-3 ${isUnread ? "bg-emerald-50/40 dark:bg-emerald-950/30 border-emerald-200/60" : "bg-card"}`}>
                  <div className="flex items-start gap-2">
                    {isUnread && <span className="mt-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{n.title}</p>
                      {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.href ? <Link href={n.href}>{body}</Link> : body}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
