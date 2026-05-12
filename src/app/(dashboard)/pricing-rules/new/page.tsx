import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { PricingRuleForm } from "@/components/pricing/pricing-rule-form";
import { requireRole } from "@/lib/auth/guards";
import { listOrganizations } from "@/lib/api/organizations";

export const dynamic = "force-dynamic";

export default async function NewPricingRulePage() {
  await requireRole(["super_admin","developer_admin","compound_manager","finance_officer"]);
  const orgs = await listOrganizations();
  if (orgs.length === 0) redirect("/organizations");
  return (
    <div>
      <PageHeader title="New pricing rule" description="Define how a service fee is computed." />
      <PricingRuleForm organizations={orgs.map((o) => ({ id: o.id, name: o.name }))} />
    </div>
  );
}
