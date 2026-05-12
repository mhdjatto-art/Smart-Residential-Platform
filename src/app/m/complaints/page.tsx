import Link from "next/link";
import { Plus } from "lucide-react";
import { MobileTopbar } from "@/components/mobile/topbar";
import { StatusBadge } from "@/components/shared/status-badge";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

interface TicketRow {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
}

export default async function MobileComplaintsPage() {
  const ctx = await getResidentContext();
  const supabase = await createClient();
  const { t } = await getT();
  let tickets: TicketRow[] = [];
  if (ctx.resident_id) {
    const { data } = await supabase.from("tickets")
      .select("id,ticket_number,subject,status,priority,created_at")
      .eq("resident_id", ctx.resident_id)
      .order("created_at", { ascending: false })
      .limit(50);
    tickets = (data ?? []) as TicketRow[];
  }

  return (
    <div>
      <MobileTopbar title={t("headers.complaints_title")} userId={ctx.user_id} unread={0} />
      <div className="p-4 space-y-3">
        <Link href="/m/complaints/new" className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow">
          <Plus className="h-4 w-4" /> {t("mobile.submit_new_complaint")}
        </Link>
        {tickets.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">{t("mobile.no_complaints")}</p>
        ) : (
          <ul className="space-y-2">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/m/complaints/${t.id}`} className="block rounded-xl border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{t.subject}</p>
                      <p className="text-xs text-muted-foreground font-mono">{t.ticket_number}</p>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Priority: {t.priority} · {new Date(t.created_at).toLocaleDateString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
