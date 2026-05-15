"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { useT } from "@/lib/i18n/client";

interface MobileTopbarProps {
  title: string;
  userId: string;
  unread: number;
  showBack?: boolean;
}

export function MobileTopbar({ title, userId, unread, showBack = false }: MobileTopbarProps) {
  const router = useRouter();
  const { t } = useT();
  return (
    <header
      className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl pt-[env(safe-area-inset-top)]"
      role="banner"
    >
      <div className="flex items-center gap-2 px-3 h-14">
        {showBack ? (
          <button
            onClick={() => router.back()}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full transition-all duration-150 active:scale-90 hover:bg-muted active:bg-muted/80 rtl:rotate-180"
            aria-label={t("actions.back")}
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
          </button>
        ) : (
          <div className="w-11" />
        )}
        <h1 className="flex-1 truncate text-base font-semibold tracking-tight">{title}</h1>
        <NotificationBell userId={userId} initialUnread={unread} />
      </div>
    </header>
  );
}
