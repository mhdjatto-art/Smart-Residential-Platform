import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { AutomationRuleForm } from "@/components/automation/automation-rule-form";
import { requireRole } from "@/lib/auth/guards";
import { listOrganizations } from "@/lib/api/organizations";

export const dynamic = "force-dynamic";

export default async function NewAutomationRulePage() {
  await requireRole(["super_admin","developer_admin","compound_manager"]);
  const orgs = await listOrganizations();
  if (orgs.length === 0) redirect("/organizations");
  return (
    <div>
      <PageHeader title="New automation rule" description="Set a trigger + action. Workers will pick up jobs as they're enqueued." />
      <AutomationRuleForm organizations={orgs.map((o) => ({ id: o.id, name: o.name }))} />
    </div>
  );
}
