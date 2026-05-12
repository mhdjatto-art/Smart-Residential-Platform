import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { MobileTopbar } from "@/components/mobile/topbar";
import { StatusBadge } from "@/components/shared/status-badge";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface MyOrderRow {
  id: string;
  order_number: string;
  order_status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  provider_name: string | null;
}

export default async function MyOrdersPage() {
  const ctx = await getResidentContext();
  const supabase = await createClient();
  let orders: MyOrderRow[] = [];
  if (ctx.resident_id) {
    const { data } = await supabase
      .from("marketplace_orders")
      .select("id,order_number,order_status,total_amount,currency,created_at,provider:service_providers(provider_name)")
      .eq("resident_id", ctx.resident_id)
      .order("created_at", { ascending: false })
      .limit(50);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orders = ((data ?? []) as any[]).map((o) => ({
      id: o.id,
      order_number: o.order_number,
      order_status: o.order_status,
      total_amount: Number(o.total_amount ?? 0),
      currency: o.currency ?? "USD",
      created_at: o.created_at,
      provider_name: o.provider?.provider_name ?? null,
    }));
  }

  return (
    <div>
      <MobileTopbar title="My orders" userId={ctx.user_id} unread={0} showBack />
      <div className="p-4 space-y-2">
        {orders.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <ShoppingBag className="mx-auto h-8 w-8 opacity-50" />
            <p className="mt-2">No orders yet.</p>
            <Link href="/m/marketplace" className="mt-3 inline-block text-emerald-600 hover:underline">Browse the marketplace</Link>
          </div>
        ) : orders.map((o) => (
          <div key={o.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{o.provider_name ?? "Order"}</p>
                <p className="text-xs text-muted-foreground font-mono">{o.order_number}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <StatusBadge status={o.order_status} />
                <p className="mt-1 text-sm font-semibold">{formatCurrency(o.total_amount, { currency: o.currency })}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
