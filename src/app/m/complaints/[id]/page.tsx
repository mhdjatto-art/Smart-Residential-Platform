import { notFound } from "next/navigation";
import { MobileTopbar } from "@/components/mobile/topbar";
import { LiveTicketStatus } from "@/components/mobile/live-ticket-status";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface TicketRow {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  resolution_notes: string | null;
}

export default async function MobileComplaintDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getResidentContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("tickets")
    .select("id,ticket_number,subject,description,status,priority,category,created_at,resolution_notes")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const t = data as unknown as TicketRow;

  return (
    <div>
      <MobileTopbar title={t.ticket_number} userId={ctx.user_id} unread={0} showBack />
      <div className="p-4 space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-base font-semibold">{t.subject}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.category} · {t.priority} · {new Date(t.created_at).toLocaleDateString()}
          </p>
          <div className="mt-3"><LiveTicketStatus ticketId={t.id} initialStatus={t.status} /></div>
          <p className="mt-4 whitespace-pre-wrap text-sm">{t.description}</p>
          {t.resolution_notes && (
            <div className="mt-4 rounded-md bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Resolution</p>
              <p className="mt-1">{t.resolution_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

