"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { NotificationBell } from "./notification-bell";

interface MobileTopbarProps {
  title: string;
  userId: string;
  unread: number;
  showBack?: boolean;
}

export function MobileTopbar({ title, userId, unread, showBack = false }: MobileTopbarProps) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="flex items-center gap-2 px-3 h-14">
        {showBack ? (
          <button onClick={() => router.back()} className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <div className="w-10" />
        )}
        <h1 className="flex-1 text-base font-semibold">{title}</h1>
        <NotificationBell userId={userId} initialUnread={unread} />
      </div>
    </header>
  );
}
