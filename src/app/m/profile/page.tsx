import Link from "next/link";
import { ChevronRight, Languages, LogOut, Mail, MapPin, Phone, Shield, User } from "lucide-react";
import { MobileTopbar } from "@/components/mobile/topbar";
import { MobileLogoutButton } from "@/components/mobile/logout-button";
import { LanguagePicker } from "@/components/i18n/language-picker";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { createClient } from "@/lib/supabase/server";
import { getActiveLocale, getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

interface ResidentProfileRow {
  full_name: string | null;
  email: string | null;
  mobile: string | null;
  resident_status: string | null;
  unit_label?: string | null;
}

export default async function MobileProfilePage() {
  const ctx = await getResidentContext();
  const locale = await getActiveLocale();
  const supabase = await createClient();
  const { t } = await getT();
  let profile: ResidentProfileRow | null = null;
  if (ctx.resident_id) {
    const { data } = await supabase
      .from("residents")
      .select("full_name,email,mobile,resident_status,unit:units(unit_number)")
      .eq("id", ctx.resident_id)
      .maybeSingle();
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = data as any;
      profile = {
        full_name: row.full_name ?? null,
        email: row.email ?? null,
        mobile: row.mobile ?? null,
        resident_status: row.resident_status ?? null,
        unit_label: row.unit?.unit_number ?? null,
      };
    }
  }

  return (
    <div>
      <MobileTopbar title={t("headers.profile_title")} userId={ctx.user_id} unread={0} />
      <div className="p-4 space-y-4">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
              <User className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{profile?.full_name ?? "Resident"}</p>
              <p className="truncate text-xs text-muted-foreground">{profile?.email ?? "—"}</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {profile?.mobile ?? "—"}</li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {profile?.email ?? "—"}</li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> Unit {profile?.unit_label ?? "—"}</li>
            <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" /> Status: {profile?.resident_status ?? "—"}</li>
          </ul>
        </div>

        <div className="rounded-2xl border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t("common.language")}</span>
          </div>
          <LanguagePicker current={locale} />
        </div>

        <div className="rounded-2xl border bg-card divide-y">
          <Link href="/m/payments/history" className="flex items-center justify-between p-3 text-sm">
            Payment history <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link href="/m/utilities" className="flex items-center justify-between p-3 text-sm">
            My utilities <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link href="/m/visitors" className="flex items-center justify-between p-3 text-sm">
            My visitors <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link href="/m/bookings" className="flex items-center justify-between p-3 text-sm">
            My bookings <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>

        <MobileLogoutButton />
        <p className="pt-4 text-center text-[10px] text-muted-foreground">
          SRP · v1 · <LogOut className="inline h-3 w-3" />
        </p>
      </div>
    </div>
  );
}
