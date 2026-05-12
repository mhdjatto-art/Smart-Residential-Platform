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
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/constants";
import { initials } from "@/lib/utils";
import type { AppRole } from "@/types";

interface TopbarProps {
  email: string | null;
  primaryRole: AppRole | null;
  orgName: string | null;
}

export function Topbar({ email, primaryRole, orgName }: TopbarProps) {
  const router = useRouter();
  const supabase = createClient();

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
            Profile
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
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
