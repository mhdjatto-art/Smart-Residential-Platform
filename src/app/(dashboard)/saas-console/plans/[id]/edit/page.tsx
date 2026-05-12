import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { PlanForm } from "@/components/saas/plan-form";
import { requireRole } from "@/lib/auth/guards";
import { getPlan } from "@/lib/api/saas";

export const metadata: Metadata = { title: "Edit plan" };
export const dynamic = "force-dynamic";

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["super_admin"]);
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();
  return (
    <div>
      <PageHeader
        title={`Edit: ${plan.name}`}
        description={`Code: ${plan.code} · Tier: ${plan.tier}`}
      />
      <PlanForm mode="edit" initial={plan} />
    </div>
  );
}
