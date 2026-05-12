import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PlanForm } from "@/components/saas/plan-form";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "New plan" };
export const dynamic = "force-dynamic";

export default async function NewPlanPage() {
  await requireRole(["super_admin"]);
  return (
    <div>
      <PageHeader
        title="New subscription plan"
        description="Create a new plan with quotas and pricing. Set quotas to blank for unlimited."
      />
      <PlanForm mode="create" />
    </div>
  );
}
