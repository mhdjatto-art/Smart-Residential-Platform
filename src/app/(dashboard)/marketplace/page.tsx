import Link from "next/link";
import { ShoppingBag, Star, Store, ClipboardList, BadgePercent, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { getMarketplaceStats } from "@/lib/api/marketplace";
import { requireRole, requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer", "maintenance_staff"]);
  const user = await requireUser();
  const stats = await getMarketplaceStats();

  let currency = "USD";
  const firstOrgId = user.organizationIds[0];
  if (firstOrgId) {
    const supabase = await createClient();
    const { data } = await supabase.from("organizations").select("currency").eq("id", firstOrgId).maybeSingle();
    currency = (data as { currency?: string } | null)?.currency ?? "USD";
  }

  return (
    <div>
      <PageHeader
        title="Marketplace"
        description="Service providers, catalog, orders, and commissions."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active providers" value={stats.active_providers} icon={Store} />
        <StatCard label="Open orders" value={stats.pending_orders} icon={ClipboardList} />
        <StatCard label="Completed (30d)" value={stats.completed_orders_30d} icon={TrendingUp} />
        <StatCard label="Avg rating" value={stats.avg_rating > 0 ? stats.avg_rating.toFixed(2) : "—"} icon={Star} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue (30d)" value={formatCurrency(stats.revenue_30d, { currency })} icon={ShoppingBag} />
        <StatCard label="Commission (30d)" value={formatCurrency(stats.commission_30d, { currency })} icon={BadgePercent} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Quick actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/service-providers/new"><Store className="h-4 w-4" />New service provider</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/orders/new"><ShoppingBag className="h-4 w-4" />Place order on behalf of resident</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/reviews"><Star className="h-4 w-4" />Moderate reviews</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Browse</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">All providers and the service catalog.</p>
            <Button asChild size="sm" variant="outline"><Link href="/service-providers">View providers</Link></Button>
            <Button asChild size="sm"><Link href="/orders">View orders</Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Financial</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">Commission tracking and payout reconciliation.</p>
            <Button asChild size="sm" variant="outline"><Link href="/payouts">Provider payouts</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
