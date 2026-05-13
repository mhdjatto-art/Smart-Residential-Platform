import Link from "next/link";
import {
  AlertOctagon, CalendarClock, ClipboardList, FileSignature, ShoppingBag, UserPlus, Wallet, Wallet2, Wifi, Zap,
} from "lucide-react";
import { MobileTopbar } from "@/components/mobile/topbar";
import { LiveDashboardWidgets } from "@/components/mobile/live-dashboard-widgets";
import { getMobileDashboard } from "@/lib/api/resident-mobile";
import { getActiveBranding } from "@/components/layout/branding-provider";
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

  return (
    <div>
      <MobileTopbar title={t("mobile.hi", { name: firstName })} userId={ctx.user_id} unread={dash.unread_notifications} />

      <div className="p-4 space-y-4">
        {/* Hero balance card — branded gradient overrides default emerald */}
        <div
          className={`rounded-2xl p-5 text-white shadow-lg ${heroStyle ? "" : "bg-gradient-to-br from-emerald-500 to-emerald-700"}`}
          style={heroStyle}
        >
          <p className="text-xs uppercase tracking-wider opacity-90">{t("mobile.outstanding_balance")}</p>
          <p className="mt-1 text-3xl font-bold">{formatCurrency(dash.outstanding_balance, { currency: ctx.currency })}</p>
          {dash.upcoming_installment_due_date && (
            <p className="mt-2 text-sm opacity-90 flex items-center gap-1">
              <CalendarClock className="h-4 w-4" />
              {t("mobile.next_due", {
                amount: formatCurrency(dash.upcoming_installment_amount, { currency: ctx.currency }),
                date: new Date(dash.upcoming_installment_due_date).toLocaleDateString(),
              })}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Link href="/m/payments" className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold backdrop-blur hover:bg-white/30">{t("actions.pay_now")}</Link>
            <Link href="/m/payments/history" className="rounded-full border border-white/30 px-4 py-1.5 text-sm">{t("actions.history")}</Link>
          </div>
        </div>

        {/* Live widgets (real-time) */}
        <LiveDashboardWidgets initial={dash} />

        {/* Module shortcuts */}
        <div className="grid grid-cols-4 gap-3 pt-2">
          <ModTile href="/m/wallet"     icon={Wallet2}  label="Wallet" />
          <ModTile href="/m/payments"   icon={Wallet}   label="Pay" />
          <ModTile href="/m/utilities"  icon={Zap}      label="Utility" />
          <ModTile href="/m/internet"   icon={Wifi}     label="Internet" />
          <ModTile href="/m/complaints" icon={ClipboardList} label="Complaint" />
          <ModTile href="/m/visitors"   icon={UserPlus} label="Visitor" />
          <ModTile href="/m/bookings"   icon={CalendarClock} label="Book" />
          <ModTile href="/m/marketplace" icon={ShoppingBag} label="Shop" />
          <ModTile href="/m/contracts" icon={FileSignature} label="Contracts" />
          <ModTile href="/m/notifications" icon={AlertOctagon} label="Alerts" />
        </div>
      </div>
    </div>
  );
}

function ModTile({ href, icon: Icon, label }: { href: string; icon: typeof Wallet; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border bg-card p-3 text-xs font-medium hover:bg-muted transition-colors"
    >
      <Icon className="h-5 w-5 text-emerald-600" />
      {label}
    </Link>
  );
}
