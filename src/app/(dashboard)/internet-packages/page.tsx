import Link from "next/link";
import { Wifi, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { listInternetPackages } from "@/lib/api/utilities";
import { formatCurrency } from "@/lib/utils";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function InternetPackagesPage() {
  await requireCapability("utility:read");
  const packages = await listInternetPackages();

  return (
    <div>
      <PageHeader
        title="Internet packages"
        description="Speed tiers, monthly pricing, and suspension policies."
        actions={<Button asChild><Link href="/internet-packages/new"><Plus className="h-4 w-4" />Add package</Link></Button>}
      />

      {packages.length === 0 ? (
        <EmptyState icon={Wifi} title="No internet packages" description="Define speed tiers so residents can subscribe."
          action={<Button asChild><Link href="/internet-packages/new">Add package</Link></Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant={p.is_active ? "success" : "muted"}>{p.is_active ? "Active" : "Inactive"}</Badge>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{p.package_tier}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{p.package_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {p.speed_mbps_down} Mbps {p.speed_mbps_up && `↓ / ${p.speed_mbps_up} Mbps ↑`}
                  </p>
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {formatCurrency(p.monthly_price, { currency: p.currency })}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </div>
                {p.data_cap_gb !== null && (
                  <p className="text-xs text-muted-foreground">
                    {p.data_cap_gb === 0 ? "Unlimited data" : `${p.data_cap_gb} GB cap`}
                  </p>
                )}
                <p className="text-xs text-muted-foreground capitalize">
                  Suspension: {p.suspension_policy.replace("_", " ")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
