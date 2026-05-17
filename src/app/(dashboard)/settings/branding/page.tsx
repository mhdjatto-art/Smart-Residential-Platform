import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { BrandingForm } from "@/components/saas/branding-form";
import { OrgSwitcher } from "@/components/saas/org-switcher";
import { requireRole, requireUser } from "@/lib/auth/guards";
import { getBranding } from "@/lib/api/saas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface OrgRow { id: string; name: string; slug: string }

/**
 * Branding settings page.
 *
 * Resolution order for the active org:
 *   1. ?org=<uuid> query param (super_admin / developer_admin only — lets
 *      them switch tenants from the URL).
 *   2. user.organizationIds[0] — works for compound_manager who is always
 *      bound to exactly one tenant.
 *   3. First org in DB (super_admin / developer_admin fallback so the page
 *      always renders something instead of bouncing to /organizations).
 *
 * For super_admin / developer_admin we also render an <OrgSwitcher /> so
 * they can hop between tenants without typing UUIDs.
 */
export default async function BrandingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  await requireRole(["super_admin","developer_admin","compound_manager"]);
  const user = await requireUser();
  const sp = await searchParams;

  const canSwitch =
    user.isSuperAdmin ||
    user.roles.some((r) => r.role === "developer_admin");

  // 1. Try query param (privileged only — ignored for compound_manager).
  let orgId: string | null = null;
  if (canSwitch && sp.org) {
    orgId = sp.org;
  }

  // 2. Fall back to the user's own org assignment.
  if (!orgId) orgId = user.organizationIds[0] ?? null;

  // 3. Super-admin fallback: pick the first org so the page renders.
  let allOrgs: OrgRow[] = [];
  if (canSwitch) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .order("created_at")
      .limit(50);
    allOrgs = (data as OrgRow[] | null) ?? [];
    if (!orgId && allOrgs.length > 0) orgId = allOrgs[0]!.id;
  }

  if (!orgId) redirect("/organizations");

  const branding = await getBranding(orgId);
  const activeOrg = allOrgs.find((o) => o.id === orgId);

  return (
    <div>
      <PageHeader
        title="Branding"
        titleKey="headers.branding_title"
        description="White-label your tenant — logo, colors, typography, login page, and email signature."
        descKey="headers.branding_desc" />

      {canSwitch && allOrgs.length > 1 && (
        <div className="mb-6">
          <OrgSwitcher
            orgs={allOrgs}
            activeOrgId={orgId}
            activeOrgName={activeOrg?.name ?? "Unknown"}
          />
        </div>
      )}

      <BrandingForm orgId={orgId} initial={branding} />
    </div>
  );
}
