"use client";

/**
 * Realtime notification bell — subscribes to `notifications` rows for the
 * current user and updates an unread badge live. Used in the mobile topbar.
 */

import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";

interface NotificationBellProps {
  userId: string;
  initialUnread: number;
}

export function NotificationBell({ userId, initialUnread }: NotificationBellProps) {
  const [unread, setUnread] = useState(initialUnread);

  useRealtimeChannel<{ id: string; read_at: string | null }>({
    table: "notifications",
    filter: `user_id=eq.${userId}`,
    onInsert: (row) => {
      if (!row.read_at) setUnread((n) => n + 1);
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
    <Link href="/m/notifications" className="relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted">
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute right-1 top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
