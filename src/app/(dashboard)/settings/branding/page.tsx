import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { BrandingForm } from "@/components/saas/branding-form";
import { requireRole, requireUser } from "@/lib/auth/guards";
import { getBranding } from "@/lib/api/saas";

export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage() {
  await requireRole(["super_admin","developer_admin","compound_manager"]);
  const user = await requireUser();
  const orgId = user.organizationIds[0];
  if (!orgId) redirect("/organizations");
  const branding = await getBranding(orgId);

  return (
    <div>
      <PageHeader
        title="Branding"
        titleKey="headers.branding_title"
        description="White-label your tenant — logo, colors, typography, and email signature."
        descKey="headers.branding_desc" />
      <BrandingForm orgId={orgId} initial={branding} />
    </div>
  );
}
