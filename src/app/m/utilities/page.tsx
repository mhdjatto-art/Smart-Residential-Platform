import { MobileTopbar } from "@/components/mobile/topbar";
import { StatusBadge } from "@/components/shared/status-badge";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

interface SubscriptionRow {
  id: string;
  subscription_type: string;
  monthly_fee: number;
  currency: string;
  status: string;
}

interface UtilityBillRow {
  id: string;
  bill_number: string;
  utility_type: string;
  total_amount: number;
  paid_amount: number;
  bill_status: string;
  currency: string;
  due_date: string | null;
}

export default async function MobileUtilitiesPage() {
  const ctx = await getResidentContext();
  const supabase = await createClient();
  const { t } = await getT();

  let subs: SubscriptionRow[] = [];
  let bills: UtilityBillRow[] = [];
  if (ctx.resident_id) {
    const [s, b] = await Promise.all([
      supabase.from("utility_subscriptions")
        .select("id,subscription_type,monthly_fee,currency,status")
        .eq("resident_id", ctx.resident_id)
        .order("subscription_type"),
      supabase.from("utility_bills")
        .select("id,bill_number,utility_type,total_amount,paid_amount,bill_status,currency,due_date")
        .eq("resident_id", ctx.resident_id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    subs = (s.data ?? []) as SubscriptionRow[];
    bills = (b.data ?? []) as UtilityBillRow[];
  }

  return (
    <div>
      <MobileTopbar title={t("headers.utilities_title")} userId={ctx.user_id} unread={0} showBack />
      <div className="p-4 space-y-4">
        <section>
          <h2 className="px-1 text-sm font-semibold text-muted-foreground">{t("mobile.subscriptions")}</h2>
          {subs.length === 0 ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">{t("mobile.no_subscriptions")}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {subs.map((s) => (
                <li key={s.id} className="rounded-xl border bg-card p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium capitalize">{s.subscription_type}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(s.monthly_fee, { currency: s.currency })} / month</p>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="px-1 text-sm font-semibold text-muted-foreground">{t("mobile.recent_bills")}</h2>
          {bills.length === 0 ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">{t("mobile.no_bills")}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {bills.map((b) => (
                <li key={b.id} className="rounded-xl border bg-card p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium capitalize">{b.utility_type}</p>
                    <p className="text-xs text-muted-foreground font-mono">{b.bill_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(b.total_amount, { currency: b.currency })}</p>
                    <p className="mt-0.5"><StatusBadge status={b.bill_status} /></p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
