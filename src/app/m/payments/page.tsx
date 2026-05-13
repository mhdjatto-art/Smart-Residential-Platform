import { Wallet } from "lucide-react";
import { MobileTopbar } from "@/components/mobile/topbar";
import { PayBillButton } from "@/components/mobile/pay-bill-button";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

interface InstallmentRow {
  id: string;
  installment_number: number;
  total_due: number;
  penalty_amount: number;
  paid_amount: number;
  due_date: string;
  status: string;
}

interface UtilityBillRow {
  id: string;
  bill_number: string;
  utility_type: string;
  total_amount: number;
  paid_amount: number;
  penalty_amount: number;
  due_date: string | null;
  status: string;
  currency: string;
}

export default async function MobilePaymentsPage() {
  const ctx = await getResidentContext();
  const supabase = await createClient();
  const { t } = await getT();

  let installments: InstallmentRow[] = [];
  let utilityBills: UtilityBillRow[] = [];

  if (ctx.resident_id) {
    const [inst, bills] = await Promise.all([
      supabase.from("installment_schedules")
        .select("id,installment_number,total_due,penalty_amount,paid_amount,due_date,status,installment_contracts!inner(resident_id)")
        .eq("installment_contracts.resident_id", ctx.resident_id)
        .neq("status", "paid")
        .order("due_date")
        .limit(20),
      supabase.from("utility_bills")
        .select("id,bill_number,utility_type,total_amount,paid_amount,penalty_amount,due_date,status,currency")
        .eq("resident_id", ctx.resident_id)
        .neq("status", "paid")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(20),
    ]);
    installments = (inst.data ?? []) as unknown as InstallmentRow[];
    utilityBills = (bills.data ?? []) as UtilityBillRow[];
  }

  const remaining = (r: InstallmentRow) => Math.max(0, Number(r.total_due) + Number(r.penalty_amount ?? 0) - Number(r.paid_amount));
  const totalDue =
    installments.reduce((s, r) => s + remaining(r), 0) +
    utilityBills.reduce((s, r) => s + Math.max(0, r.total_amount - r.paid_amount), 0);

  return (
    <div>
      <MobileTopbar title={t("headers.payments_title")} userId={ctx.user_id} unread={0} />

      <div className="p-4 space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-white">
          <p className="text-xs uppercase tracking-wider opacity-90">{t("mobile.total_due")}</p>
          <p className="mt-1 text-3xl font-bold">{formatCurrency(totalDue, { currency: ctx.currency })}</p>
          <p className="mt-1 text-xs opacity-80">
            {t("mobile.installments_count", { count: installments.length })} · {t("mobile.utility_bills_count", { count: utilityBills.length })}
          </p>
        </div>

        <section>
          <h2 className="px-1 text-sm font-semibold text-muted-foreground">{t("mobile.installments_section")}</h2>
          {installments.length === 0 ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">{t("mobile.no_installments")}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {installments.map((r) => (
                <li key={r.id} className="rounded-xl border bg-card p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t("mobile.installment_n", { n: r.installment_number })}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.due_date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(remaining(r), { currency: ctx.currency })}</p>
                    <p className="text-[11px] uppercase text-muted-foreground">{r.status}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="px-1 text-sm font-semibold text-muted-foreground">{t("mobile.utility_bills_section")}</h2>
          {utilityBills.length === 0 ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">{t("mobile.no_utility_bills")}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {utilityBills.map((r) => {
                const remainingBill = Math.max(0, r.total_amount + (r.penalty_amount ?? 0) - r.paid_amount);
                return (
                  <li key={r.id} className="rounded-xl border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <Wallet className="h-4 w-4 shrink-0 text-emerald-600" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium capitalize">{r.utility_type}</p>
                          <p className="truncate text-xs text-muted-foreground font-mono">{r.bill_number}</p>
                          {r.penalty_amount > 0 && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400">
                              + {formatCurrency(r.penalty_amount, { currency: r.currency })} late fee
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="text-sm font-semibold tabular-nums">{formatCurrency(remainingBill, { currency: r.currency })}</p>
                        <PayBillButton
                          billId={r.id}
                          billNumber={r.bill_number}
                          utilityType={r.utility_type}
                          totalAmount={r.total_amount}
                          penaltyAmount={r.penalty_amount ?? 0}
                          paidAmount={r.paid_amount}
                          currency={r.currency}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
