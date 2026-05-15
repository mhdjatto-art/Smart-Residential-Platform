import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FacilityForm } from "@/components/facilities/facility-form";
import { requireRole } from "@/lib/auth/guards";
import { listCompoundOptions } from "@/lib/api/compounds";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "New facility" };
export const dynamic = "force-dynamic";

export default async function NewFacilityPage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const compounds = await listCompoundOptions();
  const { t } = await getT();

  if (compounds.length === 0) {
    return (
      <div>
        <PageHeader title={t("ops.new_facility_title")} description={t("ops.new_facility_desc")} />
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">{t("ops.new_facility_need_compound")}</p>
            <Button asChild className="mt-4"><Link href="/compounds/new">{t("dashboard.add_compound")}</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("ops.new_facility_title")}
        description={t("ops.new_facility_desc_full")}
      />
      <FacilityForm compounds={compounds} />
    </div>
  );
}
