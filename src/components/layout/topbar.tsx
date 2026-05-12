"use client";

import { LogOut, User as UserIcon } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/constants";
import { initials } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { LocaleCode } from "@/lib/i18n";
import type { AppRole } from "@/types";

interface TopbarProps {
  email: string | null;
  primaryRole: AppRole | null;
  orgName: string | null;
  locale: LocaleCode;
}

export function Topbar({ email, primaryRole, orgName, locale }: TopbarProps) {
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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur lg:px-8">
      <div className="flex items-center gap-3">
        {orgName && (
          <Badge variant="muted" className="font-medium">
            {orgName}
          </Badge>
        )}
        {primaryRole && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {ROLE_LABELS[primaryRole]}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
      <LanguagePicker current={locale} />
      <Button
        variant="outline"
        size="sm"
        onClick={() => void signOut()}
        className="hidden gap-1.5 sm:inline-flex"
        title={t("actions.sign_out")}
      >
        <LogOut className="h-4 w-4" />
        <span className="text-xs font-medium">{t("actions.sign_out")}</span>
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
          <Button variant="ghost" className="h-10 gap-2 pl-2 pr-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials(display)}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">{display}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{display}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer">
            <UserIcon className="mr-2 h-4 w-4" />
            {t("common.profile")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:text-destructive"
            onSelect={(e) => {
              e.preventDefault();
              void signOut();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t("actions.sign_out")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
