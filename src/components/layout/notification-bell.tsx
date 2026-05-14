"use client";

/**
 * Desktop topbar notification bell.
 *
 * Live unread counter via Supabase realtime + toast popup whenever a new
 * notification row lands for this user. Click → /notifications page.
 */

import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";

interface NotificationBellProps {
  userId: string;
  initialUnread: number;
}

interface NotifRow extends Record<string, unknown> {
  id: string;
  read_at: string | null;
  title?: string | null;
  body?: string | null;
  href?: string | null;
  kind?: string | null;
}

export function NotificationBell({ userId, initialUnread }: NotificationBellProps) {
  const [unread, setUnread] = useState(initialUnread);

  useRealtimeChannel<NotifRow>({
    table: "notifications",
    filter: `user_id=eq.${userId}`,
    onInsert: (row) => {
      if (!row.read_at) {
        setUnread((n) => n + 1);
        // Toast popup
        toast(row.title ?? "New notification", {
          description: row.body ?? undefined,
          action: row.href
            ? {
                label: "View",
                onClick: () => { window.location.href = row.href!; },
              }
            : undefined,
        });
      }
    },
    onUpdate: (row, old) => {
      if (!old.read_at && row.read_at) setUnread((n) => Math.max(0, n - 1));
      if (old.read_at && !row.read_at) setUnread((n) => n + 1);
    },
    onDelete: (row) => {
      if (!row.read_at) setUnread((n) => Math.max(0, n - 1));
    },
  });

  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link href="/notifications" aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    </Button>
  );
}
