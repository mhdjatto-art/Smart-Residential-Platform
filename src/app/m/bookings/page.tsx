import { CalendarDays } from "lucide-react";
import { MobileTopbar } from "@/components/mobile/topbar";
import { StatusBadge } from "@/components/shared/status-badge";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface BookingRow {
  id: string;
  facility_name: string | null;
  fee_currency: string;
  start_time: string;
  end_time: string;
  status: string;
  fee_amount: number;
}

export default async function MobileBookingsPage() {
  const ctx = await getResidentContext();
  const supabase = await createClient();
  let bookings: BookingRow[] = [];
  if (ctx.resident_id) {
    const { data } = await supabase.from("facility_bookings")
      .select("id,start_time,end_time,status,fee_amount,facility:facilities(name,fee_currency)")
      .eq("resident_id", ctx.resident_id)
      .order("start_time", { ascending: false })
      .limit(50);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bookings = ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      facility_name: r.facility?.name ?? null,
      fee_currency: r.facility?.fee_currency ?? ctx.currency,
      start_time: r.start_time,
      end_time: r.end_time,
      status: r.status,
      fee_amount: Number(r.fee_amount ?? 0),
    }));
  }

  return (
    <div>
      <MobileTopbar title="Facility bookings" userId={ctx.user_id} unread={0} showBack />
      <div className="p-4 space-y-3">
        {bookings.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <CalendarDays className="mx-auto h-8 w-8 opacity-50" />
            <p className="mt-2">No bookings yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {bookings.map((b) => (
              <li key={b.id} className="rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{b.facility_name ?? "Facility"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.start_time).toLocaleString()} → {new Date(b.end_time).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={b.status} />
                    {b.fee_amount > 0 && <p className="mt-1 text-xs">{formatCurrency(b.fee_amount, { currency: b.fee_currency })}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
