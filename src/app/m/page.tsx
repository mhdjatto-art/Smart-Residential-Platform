import Link from "next/link";
import {
  AlertOctagon, CalendarClock, ClipboardList, FileSignature, ShoppingBag, UserPlus, Wallet, Wifi, Zap,
} from "lucide-react";
import { MobileTopbar } from "@/components/mobile/topbar";
import { LiveDashboardWidgets } from "@/components/mobile/live-dashboard-widgets";
import { getMobileDashboard } from "@/lib/api/resident-mobile";
import { getActiveBranding } from "@/components/layout/branding-provider";
import { getEnabledFeatures } from "@/lib/auth/feature-flags";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function MobileHome() {
  const dash = await getMobileDashboard();
  const { ctx } = dash;
  const { t } = await getT();
  const firstName = ctx.full_name?.split(" ")[0] ?? "";
  const branding = await getActiveBranding(ctx.organization_id);
  const heroStyle = branding?.primary_color
    ? { backgroundImage: `linear-gradient(135deg, ${branding.primary_color}, ${branding.accent_color ?? branding.primary_color})` }
    : undefined;

  // Phase 17 — read enabled feature flags so we can hide disabled modules from
  // the resident's home tiles. Same source as the desktop sidebar.
  const enabledRaw = await getEnabledFeatures(ctx.organization_id);
  // Treat "no rows at all" as default-open (show everything)
  const isEnabled = (key: string) => enabledRaw.size === 0 || enabledRaw.has(key);

  // Full tile list, each tagged with the feature_flag key it depends on.
  // Tiles without a `feature` are always shown (wallet, payments, notifications).
  const tiles: { href: string; icon: typeof Wallet; label: string; tone: string; feature?: string }[] = [
    { href: "/m/wallet",        icon: Wallet,        label: "Wallet",    tone: "emerald", feature: "wallets" },
    { href: "/m/payments",      icon: Wallet,        label: "Pay",       tone: "blue" },
    { href: "/m/utilities",     icon: Zap,           label: "Utility",   tone: "amber",   feature: "utilities" },
    { href: "/m/internet",      icon: Wifi,          label: "Internet",  tone: "cyan",    feature: "utilities" },
    { href: "/m/complaints",    icon: ClipboardList, label: "Complaint", tone: "rose",    feature: "tickets" },
    { href: "/m/visitors",      icon: UserPlus,      label: "Visitor",   tone: "violet",  feature: "visitors" },
    { href: "/m/bookings",      icon: CalendarClock, label: "Book",      tone: "indigo",  feature: "facilities" },
    { href: "/m/marketplace",   icon: ShoppingBag,   label: "Shop",      tone: "pink",    feature: "marketplace" },
    { href: "/m/contracts",     icon: FileSignature, label: "Contracts", tone: "teal",    feature: "contracts" },
    { href: "/m/notifications", icon: AlertOctagon,  label: "Alerts",    tone: "orange" },
  ];
  const visibleTiles = tiles.filter((t) => !t.feature || isEnabled(t.feature));

  return (
    <div>
      <MobileTopbar title={t("mobile.hi", { name: firstName })} userId={ctx.user_id} unread={dash.unread_notifications} />

      <div className="p-4 space-y-5">
        {/* Hero balance card — branded gradient overrides default emerald */}
        <div
          className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-emerald-500/20 ${heroStyle ? "" : "bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700"}`}
          style={heroStyle}
        >
          {/* Decorative circle accents */}
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-white/5 blur-3xl" aria-hidden />

          <div className="relative">
            <p className="text-[11px] uppercase tracking-widest opacity-90">{t("mobile.outstanding_balance")}</p>
            <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">{formatCurrency(dash.outstanding_balance, { currency: ctx.currency })}</p>
            {dash.upcoming_installment_due_date && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
                <CalendarClock className="h-3.5 w-3.5" />
                {t("mobile.next_due", {
                  amount: formatCurrency(dash.upcoming_installment_amount, { currency: ctx.currency }),
                  date: new Date(dash.upcoming_installment_due_date).toLocaleDateString(),
                })}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <Link
                href="/m/payments"
                className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-emerald-700 shadow-md transition-all active:scale-95 hover:shadow-lg"
              >
                {t("actions.pay_now")}
              </Link>
              <Link
                href="/m/payments/history"
                className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-medium backdrop-blur transition-all active:scale-95 hover:bg-white/20"
              >
                {t("actions.history")}
              </Link>
            </div>
          </div>
        </div>

        {/* Live widgets (real-time) — filter cards by feature flags too */}
        <LiveDashboardWidgets
          initial={dash}
          showUtility={isEnabled("utilities")}
          showComplaints={isEnabled("tickets")}
          showVisitors={isEnabled("visitors")}
          showOrders={isEnabled("marketplace")}
        />

        {/* Module shortcuts — colorful, larger tap targets. Filtered by feature flags. */}
        {visibleTiles.length > 0 && (
          <div>
            <div className="grid grid-cols-4 gap-3">
              {visibleTiles.map((tile) => (
                <ModTile
                  key={tile.href}
                  href={tile.href}
                  icon={tile.icon}
                  label={tile.label}
                  tone={tile.tone as keyof typeof TONE_CLASSES}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const TONE_CLASSES: Record<string, string> = {
  emerald: "bg-emerald-50  text-emerald-600  dark:bg-emerald-950/40  dark:text-emerald-400",
  blue:    "bg-blue-50     text-blue-600     dark:bg-blue-950/40     dark:text-blue-400",
  amber:   "bg-amber-50    text-amber-600    dark:bg-amber-950/40    dark:text-amber-400",
  cyan:    "bg-cyan-50     text-cyan-600     dark:bg-cyan-950/40     dark:text-cyan-400",
  rose:    "bg-rose-50     text-rose-600     dark:bg-rose-950/40     dark:text-rose-400",
  violet:  "bg-violet-50   text-violet-600   dark:bg-violet-950/40   dark:text-violet-400",
  indigo:  "bg-indigo-50   text-indigo-600   dark:bg-indigo-950/40   dark:text-indigo-400",
  pink:    "bg-pink-50     text-pink-600     dark:bg-pink-950/40     dark:text-pink-400",
  teal:    "bg-teal-50     text-teal-600     dark:bg-teal-950/40     dark:text-teal-400",
  orange:  "bg-orange-50   text-orange-600   dark:bg-orange-950/40   dark:text-orange-400",
};

function ModTile({ href, icon: Icon, label, tone = "emerald" }: { href: string; icon: typeof Wallet; label: string; tone?: keyof typeof TONE_CLASSES }) {
  return (
    <Link
      href={href}
      className="group flex min-h-[80px] flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-3 text-[11px] font-medium transition-all duration-200 active:scale-95 hover:border-primary/30 hover:shadow-md"
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONE_CLASSES[tone]} transition-transform duration-200 group-hover:scale-110`}>
        <Icon className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <span className="leading-tight">{label}</span>
    </Link>
  );
}
