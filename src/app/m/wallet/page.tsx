import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, CheckCircle2, Wallet, Zap, Droplet, Flame, Wifi } from "lucide-react";
import { MobileTopbar } from "@/components/mobile/topbar";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { getMyWalletSummary } from "@/lib/api/wallets";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "My wallet" };
export const dynamic = "force-dynamic";

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  electricity: Zap,
  water:       Droplet,
  gas:         Flame,
  internet:    Wifi,
};

const TONE: Record<string, string> = {
  electricity: "from-amber-400 to-orange-600",
  water:       "from-sky-400 to-blue-600",
  gas:         "from-rose-400 to-red-600",
  internet:    "from-emerald-400 to-emerald-700",
};

export default async function MobileWalletPage() {
  const ctx = await getResidentContext();
  const summary = await getMyWalletSummary();

  if (!summary) {
    return (
      <div>
        <MobileTopbar title="My wallet" userId={ctx.user_id} unread={0} showBack />
        <div className="p-4">
          <div className="rounded-2xl border bg-card p-8 text-center">
            <Wallet className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              No wallet found. Your compound manager will set one up after assigning your unit.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <MobileTopbar title="My wallet" userId={ctx.user_id} unread={0} showBack />
      <div className="space-y-4 p-4">

        {/* Wallets — one card per utility */}
        {summary.wallets.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <Wallet className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              You don&apos;t have any wallets yet.
            </p>
          </div>
        ) : (
          summary.wallets.map((w) => {
            const Icon = ICON[w.utility_type] ?? Wallet;
            const tone = TONE[w.utility_type] ?? "from-slate-400 to-slate-700";
            const cutoff = w.service_state === "disconnected";
            return (
              <div
                key={w.id}
                className={`rounded-2xl bg-gradient-to-br ${tone} p-5 text-white shadow-lg`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 opacity-90" />
                      <p className="text-xs uppercase tracking-wider opacity-90">
                        {w.utility_type === "electricity" ? "كهرباء" :
                         w.utility_type === "water"       ? "ماء"   :
                         w.utility_type === "gas"         ? "غاز"   :
                         w.utility_type === "internet"    ? "إنترنت" : w.utility_type}
                      </p>
                    </div>
                    <p className="mt-2 text-3xl font-bold">{formatCurrency(w.balance, { currency: w.currency })}</p>
                    {w.is_low && !w.is_zero_or_negative && (
                      <p className="mt-1 flex items-center gap-1 text-xs opacity-95">
                        <AlertTriangle className="h-3.5 w-3.5" /> رصيد منخفض
                      </p>
                    )}
                    {cutoff && (
                      <p className="mt-1 flex items-center gap-1 text-xs opacity-95">
                        <AlertTriangle className="h-3.5 w-3.5" /> الخدمة مقطوعة — شحن مطلوب
                      </p>
                    )}
                    {!cutoff && !w.is_low && (
                      <p className="mt-1 flex items-center gap-1 text-xs opacity-90">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/m/wallet/topup?wallet=${w.id}`}
                    className="rounded-full bg-white/25 px-4 py-1.5 text-sm font-semibold backdrop-blur hover:bg-white/40"
                  >
                    شحن الآن
                  </Link>
                  <Link
                    href={`/m/wallet?focus=${w.id}`}
                    className="rounded-full border border-white/30 px-4 py-1.5 text-sm"
                  >
                    التاريخ
                  </Link>
                </div>

                {/* Cumulative stats */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] opacity-90">
                  <div>
                    <p className="uppercase tracking-wider opacity-80">إجمالي الشحن</p>
                    <p className="mt-0.5 font-medium tabular-nums">{formatCurrency(w.total_topped_up, { currency: w.currency })}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wider opacity-80">إجمالي الاستهلاك</p>
                    <p className="mt-0.5 font-medium tabular-nums">{formatCurrency(w.total_consumed, { currency: w.currency })}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Pending STS tokens */}
        {summary.pending_tokens.length > 0 && (
          <div className="rounded-2xl border bg-amber-50 p-4 dark:bg-amber-950/40">
            <p className="mb-2 text-sm font-medium">رموز شحن بانتظار إدخالها في العداد</p>
            <ul className="space-y-2">
              {summary.pending_tokens.map((t) => (
                <li key={t.id} className="rounded-lg border bg-white p-3 dark:bg-card">
                  <p className="font-mono text-lg tracking-widest">{t.token.replace(/(.{4})/g, "$1 ").trim()}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t.units.toFixed(2)} units · {formatCurrency(t.amount)} ·
                    {t.expires_at && ` ينتهي ${new Date(t.expires_at).toLocaleDateString()}`}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-muted-foreground">
              أدخل الرمز يدوياً في العداد لتفعيل الخدمة.
            </p>
          </div>
        )}

        {/* Recent topups */}
        {summary.recent_topups.length > 0 && (
          <div className="rounded-2xl border bg-card p-4">
            <p className="mb-3 text-sm font-medium">آخر عمليات الشحن</p>
            <ul className="space-y-2">
              {summary.recent_topups.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                    <div>
                      <p className="font-medium">+{formatCurrency(t.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {t.method} · {new Date(t.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    رصيد بعد: {formatCurrency(t.balance_after)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
