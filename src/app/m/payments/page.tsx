import { CalendarClock, FileText, Zap } from "lucide-react";
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

type InstallmentRowWithContract = InstallmentRow & {
  installment_contracts?: { contract_type?: string } | { contract_type?: string }[];
};

export default async function MobilePaymentsPage() {
  const ctx = await getResidentContext();
  const supabase = await createClient();
  const { t } = await getT();

  let installmentsAll: InstallmentRowWithContract[] = [];
  let utilityBills: UtilityBillRow[] = [];

  if (ctx.resident_id) {
    const [inst, bills] = await Promise.all([
      supabase.from("installment_schedules")
        .select("id,installment_number,total_due,penalty_amount,paid_amount,due_date,status,installment_contracts!inner(resident_id,contract_type)")
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
    installmentsAll = (inst.data ?? []) as unknown as InstallmentRowWithContract[];
    utilityBills    = (bills.data ?? []) as UtilityBillRow[];
  }

  // Split rows by contract_type so we render the right section based on tenancy.
  const ctypeOf = (r: InstallmentRowWithContract): string | undefined => {
    const c = r.installment_contracts;
    if (!c) return undefined;
    if (Array.isArray(c)) return c[0]?.contract_type;
    return c.contract_type;
  };
  const propertyInstallments = installmentsAll.filter((r) => {
    const c = ctypeOf(r);
    return c === "property_sale" || c === "lease_to_own";
  });
  const rentInstallments = installmentsAll.filter((r) => ctypeOf(r) === "rental");

  const isOwner = ctx.tenancy_type === "owner";
  // Owner sees property installments; tenant sees rent. Both see utility bills.
  const installments: InstallmentRow[] = isOwner ? propertyInstallments : rentInstallments;
  const sectionTitle = isOwner ? t("mobile.installments_section") : t("mobile.rent_section");
  const sectionEmpty = isOwner ? t("mobile.no_installments")    : t("mobile.no_rent");
  const itemLabel    = (n: number) => isOwner
    ? t("mobile.installment_n", { n })
    : t("mobile.rent_period_n", { n });

  const remaining = (r: InstallmentRow) => Math.max(0, Number(r.total_due) + Number(r.penalty_amount ?? 0) - Number(r.paid_amount));
  const totalDue =
    installments.reduce((s, r) => s + remaining(r), 0) +
    utilityBills.reduce((s, r) => s + Math.max(0, r.total_amount - r.paid_amount), 0);

  return (
    <div>
      <MobileTopbar title={t("headers.payments_title")} userId={ctx.user_id} unread={0} />

      <div className="p-4 space-y-5">
        {/* Hero — total due */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 p-6 text-white shadow-xl shadow-emerald-500/20">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-white/5 blur-3xl" aria-hidden />
          <div className="relative">
            <p className="text-[11px] uppercase tracking-widest opacity-90">{t("mobile.total_due")}</p>
            <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">{formatCurrency(totalDue, { currency: ctx.currency })}</p>
            <p className="mt-2 text-xs opacity-90">
              {(isOwner ? t("mobile.installments_count", { count: installments.length }) : t("mobile.rent_count", { count: installments.length }))} · {t("mobile.utility_bills_count", { count: utilityBills.length })}
            </p>
          </div>
        </div>

        {/* Installments (owner) OR Rent (tenant) */}
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{sectionTitle}</h2>
          {installments.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card/50 p-6 text-center">
              <FileText className="mx-auto h-7 w-7 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">{sectionEmpty}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {installments.map((r) => (
                <li
                  key={r.id}
                  className="flex min-h-[64px] items-center justify-between gap-3 rounded-2xl border bg-card p-4 transition-all active:scale-[0.98] hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                      <CalendarClock className="h-5 w-5" strokeWidth={2.25} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{itemLabel(r.installment_number)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(r.due_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-sm font-bold tabular-nums">{formatCurrency(remaining(r), { currency: ctx.currency })}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.status}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Utility bills */}
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("mobile.utility_bills_section")}</h2>
          {utilityBills.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card/50 p-6 text-center">
              <Zap className="mx-auto h-7 w-7 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">{t("mobile.no_utility_bills")}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {utilityBills.map((r) => {
                const remainingBill = Math.max(0, r.total_amount + (r.penalty_amount ?? 0) - r.paid_amount);
                return (
                  <li key={r.id} className="rounded-2xl border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                          <Zap className="h-5 w-5" strokeWidth={2.25} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold capitalize">{r.utility_type}</p>
                          <p className="truncate text-xs text-muted-foreground font-mono">{r.bill_number}</p>
                          {r.penalty_amount > 0 && (
                            <p className="mt-0.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                              + {formatCurrency(r.penalty_amount, { currency: r.currency })} late fee
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <p className="text-sm font-bold tabular-nums">{formatCurrency(remainingBill, { currency: r.currency })}</p>
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
