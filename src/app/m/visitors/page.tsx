import Link from "next/link";
import { Plus, UserPlus } from "lucide-react";
import { MobileTopbar } from "@/components/mobile/topbar";
import { StatusBadge } from "@/components/shared/status-badge";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

interface VisitorRow {
  id: string;
  full_name: string;
  visitor_type: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
}

export default async function MobileVisitorsPage() {
  const ctx = await getResidentContext();
  const supabase = await createClient();
  const { t } = await getT();
  let visitors: VisitorRow[] = [];
  if (ctx.resident_id) {
    const { data } = await supabase.from("visitors")
      .select("id,full_name,visitor_type,scheduled_date,scheduled_time,status")
      .eq("resident_id", ctx.resident_id)
      .order("scheduled_date", { ascending: false })
      .limit(50);
    visitors = (data ?? []) as VisitorRow[];
  }

  return (
    <div>
      <MobileTopbar title={t("headers.visitors_title")} userId={ctx.user_id} unread={0} showBack />
      <div className="p-4 space-y-3">
        <Link href="/m/visitors/new" className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow">
          <Plus className="h-4 w-4" /> {t("mobile.pre_register_visitor")}
        </Link>
        {visitors.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <UserPlus className="mx-auto h-8 w-8 opacity-50" />
            <p className="mt-2">{t("mobile.no_visitors")}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visitors.map((v) => (
              <li key={v.id} className="rounded-xl border bg-card p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{v.full_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {v.visitor_type} · {new Date(v.scheduled_date).toLocaleDateString()}
                    {v.scheduled_time ? ` · ${v.scheduled_time.slice(0, 5)}` : ""}
                  </p>
                </div>
                <StatusBadge status={v.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
