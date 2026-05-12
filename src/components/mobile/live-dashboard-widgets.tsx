"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertOctagon, ClipboardList, ShoppingBag, UserPlus, Zap } from "lucide-react";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { MobileDashboard } from "@/lib/api/resident-mobile";

interface LiveDashboardWidgetsProps {
  initial: MobileDashboard;
}

/**
 * Realtime widgets that decrement/increment counters as the underlying rows
 * change. Counts always converge to server truth on next page load — these
 * subscriptions just keep them fresh in-session.
 */
export function LiveDashboardWidgets({ initial }: LiveDashboardWidgetsProps) {
  const { ctx } = initial;
  const { t } = useT();
  const [tickets, setTickets] = useState(initial.active_tickets);
  const [visitors, setVisitors] = useState(initial.pending_visitors);
  const [orders, setOrders] = useState(initial.active_orders);
  const [utility, setUtility] = useState({ count: initial.unpaid_utility_bills, amount: initial.unpaid_utility_amount });

  const residentFilter = ctx.resident_id ? `resident_id=eq.${ctx.resident_id}` : undefined;

  // Tickets — recount on insert/update/delete (status field changes matter).
  useRealtimeChannel<{ id: string; status: string }>({
    enabled: !!residentFilter,
    table: "tickets",
    filter: residentFilter,
    onInsert: (row) => {
      if (["open", "assigned", "in_progress", "pending"].includes(row.status)) setTickets((n) => n + 1);
    },
    onUpdate: (row, old) => {
      const wasActive = ["open", "assigned", "in_progress", "pending"].includes(old.status);
      const isActive = ["open", "assigned", "in_progress", "pending"].includes(row.status);
      if (!wasActive && isActive) setTickets((n) => n + 1);
      if (wasActive && !isActive) setTickets((n) => Math.max(0, n - 1));
    },
    onDelete: (row) => {
      if (["open", "assigned", "in_progress", "pending"].includes(row.status)) setTickets((n) => Math.max(0, n - 1));
    },
  });

  // Visitors
  useRealtimeChannel<{ id: string; status: string }>({
    enabled: !!residentFilter,
    table: "visitors",
    filter: residentFilter,
    onInsert: (row) => { if (["pending", "approved"].includes(row.status)) setVisitors((n) => n + 1); },
    onUpdate: (row, old) => {
      const w = ["pending", "approved"].includes(old.status);
      const i = ["pending", "approved"].includes(row.status);
      if (!w && i) setVisitors((n) => n + 1);
      if (w && !i) setVisitors((n) => Math.max(0, n - 1));
    },
    onDelete: (row) => { if (["pending", "approved"].includes(row.status)) setVisitors((n) => Math.max(0, n - 1)); },
  });

  // Marketplace orders
  useRealtimeChannel<{ id: string; order_status: string }>({
    enabled: !!residentFilter,
    table: "marketplace_orders",
    filter: residentFilter,
    onInsert: (row) => { if (["pending","confirmed","assigned","in_progress"].includes(row.order_status)) setOrders((n) => n + 1); },
    onUpdate: (row, old) => {
      const w = ["pending","confirmed","assigned","in_progress"].includes(old.order_status);
      const i = ["pending","confirmed","assigned","in_progress"].includes(row.order_status);
      if (!w && i) setOrders((n) => n + 1);
      if (w && !i) setOrders((n) => Math.max(0, n - 1));
    },
  });

  // Utility bills — track count and aggregate outstanding
  useRealtimeChannel<{ id: string; bill_status: string; total_amount: number; paid_amount: number }>({
    enabled: !!residentFilter,
    table: "utility_bills",
    filter: residentFilter,
    onInsert: (row) => {
      if (row.bill_status !== "paid") {
        const remaining = Math.max(0, Number(row.total_amount) - Number(row.paid_amount));
        setUtility((u) => ({ count: u.count + 1, amount: u.amount + remaining }));
      }
    },
    onUpdate: (row, old) => {
      const oldRemaining = Math.max(0, Number(old.total_amount) - Number(old.paid_amount));
      const newRemaining = Math.max(0, Number(row.total_amount) - Number(row.paid_amount));
      const wasPaid = old.bill_status === "paid";
      const isPaid  = row.bill_status === "paid";
      setUtility((u) => ({
        count:  u.count + (wasPaid && !isPaid ? 1 : 0) + (!wasPaid && isPaid ? -1 : 0),
        amount: Math.max(0, u.amount - (wasPaid ? 0 : oldRemaining) + (isPaid ? 0 : newRemaining)),
      }));
    },
  });

  return (
    <div className="grid grid-cols-2 gap-3">
      <Widget href="/m/utilities"  icon={Zap}            label={t("nav.utility_bills")}      primary={String(utility.count)} secondary={formatCurrency(utility.amount, { currency: ctx.currency })} tone="amber" />
      <Widget href="/m/complaints" icon={ClipboardList}  label={t("mobile.active_complaints")} primary={String(tickets)}      secondary={tickets ? t("actions.view_all") : t("common.all_clear")}  tone="sky" />
      <Widget href="/m/visitors"   icon={UserPlus}       label={t("mobile.visitors_pending")}  primary={String(visitors)}     secondary={visitors ? t("actions.view_all") : t("common.no")}        tone="violet" />
      <Widget href="/m/marketplace/orders" icon={ShoppingBag} label={t("mobile.active_orders")} primary={String(orders)}       secondary={orders ? t("actions.view_all") : t("mobile.browse_marketplace")} tone="emerald" />
      {initial.unread_notifications > 0 && (
        <Link href="/m/notifications" className="col-span-2 flex items-center gap-3 rounded-xl border bg-rose-50 p-3 text-sm dark:bg-rose-950/40">
          <AlertOctagon className="h-5 w-5 text-rose-500" />
          <span className="flex-1 font-medium">{t("mobile.new_notifications", { n: initial.unread_notifications })}</span>
          <span className="text-xs text-muted-foreground">{t("mobile.tap_to_view")}</span>
        </Link>
      )}
    </div>
  );
}

const TONE: Record<string, string> = {
  amber:   "from-amber-100 to-amber-50 dark:from-amber-950/50 dark:to-amber-900/20",
  sky:     "from-sky-100 to-sky-50 dark:from-sky-950/50 dark:to-sky-900/20",
  violet:  "from-violet-100 to-violet-50 dark:from-violet-950/50 dark:to-violet-900/20",
  emerald: "from-emerald-100 to-emerald-50 dark:from-emerald-950/50 dark:to-emerald-900/20",
};

function Widget({ href, icon: Icon, label, primary, secondary, tone }: {
  href: string; icon: typeof Zap; label: string; primary: string; secondary: string; tone: string;
}) {
  return (
    <Link href={href} className={`rounded-xl border bg-gradient-to-br ${TONE[tone]} p-3`}>
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-2xl font-bold tabular-nums">{primary}</span>
      </div>
      <p className="mt-1 text-xs font-medium">{label}</p>
      <p className="text-[11px] text-muted-foreground">{secondary}</p>
    </Link>
  );
}
