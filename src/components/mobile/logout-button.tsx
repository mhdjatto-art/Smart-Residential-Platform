"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

export function MobileLogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { t } = useT();

  function signOut() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <button
      onClick={signOut}
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" />
      {pending ? `${t("actions.sign_out")}…` : t("actions.sign_out")}
    </button>
  );
}
