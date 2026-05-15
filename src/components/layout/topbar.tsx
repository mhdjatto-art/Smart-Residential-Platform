"use client";

import { LogOut, User as UserIcon, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { LanguagePicker } from "@/components/i18n/language-picker";
import { NotificationBell } from "@/components/layout/notification-bell";
import { GlobalSearch } from "@/components/layout/global-search";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABEL_KEYS } from "@/lib/constants";
import { initials } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { LocaleCode } from "@/lib/i18n";
import type { AppRole } from "@/types";

interface TopbarProps {
  email:          string | null;
  primaryRole:    AppRole | null;
  orgName:        string | null;
  locale:         LocaleCode;
  userId?:        string;
  initialUnread?: number;
  logoUrl?:       string | null;
}

export function Topbar({
  email, primaryRole, orgName, locale, userId, initialUnread = 0, logoUrl = null,
}: TopbarProps) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useT();

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Sign out failed", { description: error.message });
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  const display = email ?? "Account";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md lg:px-6">
      {/* Left: org branding */}
      <div className="flex items-center gap-3 shrink-0">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={orgName ?? "Logo"} className="h-8 max-w-[120px] object-contain" />
        )}
        {orgName && (
          <Badge variant="muted" className="hidden font-medium md:inline-flex">
            {orgName}
          </Badge>
        )}
      </div>

      {/* Center: global search (Cmd+K) */}
      <div className="flex flex-1 justify-center px-2">
        <GlobalSearch />
      </div>

      {/* Right: notifications, language, sign out, account */}
      <div className="flex items-center gap-1 shrink-0">
        {primaryRole && (
          <span className="hidden text-xs text-muted-foreground lg:inline-block">
            {t(ROLE_LABEL_KEYS[primaryRole])}
          </span>
        )}
        {userId && <NotificationBell userId={userId} initialUnread={initialUnread} />}
        <LanguagePicker current={locale} />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void signOut()}
          className="hidden gap-1.5 sm:inline-flex"
          title={t("actions.sign_out")}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden text-xs font-medium md:inline">{t("actions.sign_out")}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void signOut()}
          className="sm:hidden"
          title={t("actions.sign_out")}
          aria-label={t("actions.sign_out")}
        >
          <LogOut className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2 px-2">
              <Avatar className="h-8 w-8 ring-2 ring-transparent transition group-hover:ring-primary/20">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials(display)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline">{display}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex items-center gap-2 py-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials(display)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{display}</p>
                {primaryRole && (
                  <p className="truncate text-[11px] text-muted-foreground">{t(ROLE_LABEL_KEYS[primaryRole])}</p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <UserIcon className="me-2 h-4 w-4" />
              {t("common.profile")}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onSelect={() => router.push("/settings")}>
              <Settings className="me-2 h-4 w-4" />
              {t("common.settings")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                void signOut();
              }}
            >
              <LogOut className="me-2 h-4 w-4" />
              {t("actions.sign_out")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
