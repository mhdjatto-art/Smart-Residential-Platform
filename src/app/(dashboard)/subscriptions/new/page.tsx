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
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "New subscription" };
export const dynamic = "force-dynamic";

export default async function NewSubscriptionPage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);

  const [units, providers, residents] = await Promise.all([
    listUnitOptions(),
    listProviders(),
    listResidentOptions(),
  ]);
  const { t } = await getT();

  if (units.length === 0) {
    return (
      <div>
        <PageHeader title={t("ops.new_subscription_title")} description={t("ops.new_subscription_desc")} />
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">{t("ops.new_subscription_no_units")}</p>
            <Button asChild className="mt-4"><Link href="/units/new">{t("forms.add_unit_btn")}</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div>
        <PageHeader title={t("ops.new_subscription_title")} description={t("ops.new_subscription_desc")} />
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">{t("ops.new_subscription_no_providers")}</p>
            <Button asChild className="mt-4"><Link href="/providers/new">{t("forms.add_provider")}</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("ops.new_subscription_title")}
        description={t("ops.new_subscription_desc_full")}
      />
      <SubscriptionForm units={units} providers={providers} residents={residents} />
    </div>
  );
}
