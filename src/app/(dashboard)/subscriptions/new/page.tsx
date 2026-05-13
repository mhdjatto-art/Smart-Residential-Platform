import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubscriptionForm } from "@/components/subscriptions/subscription-form";
import { requireRole } from "@/lib/auth/guards";
import { listUnitOptions } from "@/lib/api/units";
import { listProviders } from "@/lib/api/utilities";
import { listResidentOptions } from "@/lib/api/residents";

export const metadata: Metadata = { title: "New subscription" };
export const dynamic = "force-dynamic";

export default async function NewSubscriptionPage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);

  const [units, providers, residents] = await Promise.all([
    listUnitOptions(),
    listProviders(),
    listResidentOptions(),
  ]);

  if (units.length === 0) {
    return (
      <div>
        <PageHeader title="New subscription" description="Subscribe a unit to a utility service." />
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No units yet — create a unit first.</p>
            <Button asChild className="mt-4"><Link href="/units/new">Add unit</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div>
        <PageHeader title="New subscription" description="Subscribe a unit to a utility service." />
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No providers yet — add one before creating a subscription.</p>
            <Button asChild className="mt-4"><Link href="/providers/new">Add provider</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="New subscription"
        description="Subscribe a unit to a utility provider. Bills will auto-generate based on the billing cycle."
      />
      <SubscriptionForm units={units} providers={providers} residents={residents} />
    </div>
  );
}
