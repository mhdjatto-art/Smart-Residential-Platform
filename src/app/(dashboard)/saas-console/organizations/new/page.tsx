import { PageHeader } from "@/components/layout/page-header";
import { ProvisionTenantForm } from "@/components/saas/provision-tenant-form";
import { requireRole } from "@/lib/auth/guards";
import { listPlans } from "@/lib/api/saas";

export const dynamic = "force-dynamic";

export default async function ProvisionTenantPage() {
  await requireRole(["super_admin"]);
  const plans = await listPlans();
  return (
    <div>
      <PageHeader title="Provision a new tenant" description="One-shot organization setup — creates org, branding defaults, settings, default domain, and a 14-day trial subscription." />
      <ProvisionTenantForm plans={plans.filter((p) => p.is_active).map((p) => ({ code: p.code, name: p.name, monthly: p.monthly_price, currency: p.currency }))} />
    </div>
  );
}
