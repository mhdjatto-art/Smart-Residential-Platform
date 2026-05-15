import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowUpCircle, CheckCircle2, Wallet, Zap, Droplet, Flame, Wifi } from "lucide-react";
import { MobileTopbar } from "@/components/mobile/topbar";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { getMyWalletSummary } from "@/lib/api/wallets";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n";

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

const UTILITY_KEYS: Record<string, string> = {
  electricity: "wallet.utility_electricity",
  water:       "wallet.utility_water",
  gas:         "wallet.utility_gas",
  internet:    "wallet.utility_internet",
};

export default async function MobileWalletPage() {
  const ctx = await getResidentContext();
  const summary = await getMyWalletSummary();
  const { t } = await getT();

  if (!summary) {
    return (
      <div>
        <MobileTopbar title="My wallet" userId={ctx.user_id} unread={0} showBack />
        <div className="p-4">
          <div className="rounded-2xl border bg-card p-8 text-center">
            <Wallet className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              {t("wallet.no_wallet")}
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
              {t("wallet.no_wallets_yet")}
            </p>
          </div>
        ) : (
          summary.wallets.map((w) => {
            const Icon = ICON[w.utility_type] ?? Wallet;
            const tone = TONE[w.utility_type] ?? "from-slate-400 to-slate-700";
            const cutoff = w.service_state === "disconnected";
            const utilityLabel = UTILITY_KEYS[w.utility_type]
              ? t(UTILITY_KEYS[w.utility_type] as TranslationKey)
              : w.utility_type;
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
                        {utilityLabel}
                      </p>
                    </div>
                    <p className="mt-2 text-3xl font-bold">{formatCurrency(w.balance, { currency: w.currency })}</p>
                    {w.is_low && !w.is_zero_or_negative && (
                      <p className="mt-1 flex items-center gap-1 text-xs opacity-95">
                        <AlertTriangle className="h-3.5 w-3.5" /> {t("wallet.low_balance")}
                      </p>
                    )}
                    {cutoff && (
                      <p className="mt-1 flex items-center gap-1 text-xs opacity-95">
                        <AlertTriangle className="h-3.5 w-3.5" /> {t("wallet.service_cut")}
                      </p>
                    )}
                    {!cutoff && !w.is_low && (
                      <p className="mt-1 flex items-center gap-1 text-xs opacity-90">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {t("wallet.connected")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/m/wallet/topup?wallet=${w.id}`}
                    className="rounded-full bg-white/25 px-4 py-1.5 text-sm font-semibold backdrop-blur hover:bg-white/40"
                  >
                    {t("wallet.topup_now")}
                  </Link>
                  <Link
                    href={`/m/wallet?focus=${w.id}`}
                    className="rounded-full border border-white/30 px-4 py-1.5 text-sm"
                  >
                    {t("wallet.history")}
                  </Link>
                </div>

                {/* Cumulative stats */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] opacity-90">
                  <div>
                    <p className="uppercase tracking-wider opacity-80">{t("wallet.total_topped_up")}</p>
                    <p className="mt-0.5 font-medium tabular-nums">{formatCurrency(w.total_topped_up, { currency: w.currency })}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wider opacity-80">{t("wallet.total_consumed")}</p>
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
            <p className="mb-2 text-sm font-medium">{t("wallet.pending_tokens_title")}</p>
            <ul className="space-y-2">
              {summary.pending_tokens.map((tok) => (
                <li key={tok.id} className="rounded-lg border bg-white p-3 dark:bg-card">
                  <p className="font-mono text-lg tracking-widest">{tok.token.replace(/(.{4})/g, "$1 ").trim()}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {tok.units.toFixed(2)} units · {formatCurrency(tok.amount)} ·
                    {tok.expires_at && ` ${t("wallet.token_expires", { date: new Date(tok.expires_at).toLocaleDateString() })}`}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {t("wallet.enter_token_manually")}
            </p>
          </div>
        )}

        {/* Recent topups */}
        {summary.recent_topups.length > 0 && (
          <div className="rounded-2xl border bg-card p-4">
            <p className="mb-3 text-sm font-medium">{t("wallet.recent_topups")}</p>
            <ul className="space-y-2">
              {summary.recent_topups.slice(0, 5).map((row) => (
                <li key={row.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                    <div>
                      <p className="font-medium">+{formatCurrency(row.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {row.method} · {new Date(row.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {t("wallet.balance_after", { amount: formatCurrency(row.balance_after) })}
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
