import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { CompoundForm } from "@/components/compounds/compound-form";
import { requireRole } from "@/lib/auth/guards";
import { listOrganizations } from "@/lib/api/organizations";

export const dynamic = "force-dynamic";

export default async function NewCompoundPage() {
  await requireRole(["super_admin", "developer_admin"]);
  const orgs = await listOrganizations();

  if (orgs.length === 0) {
    redirect("/organizations");
  }

  return (
    <div>
      <PageHeader
        title="Add compound"
        description="Create a new residential project under one of your organizations."
      />
      <CompoundForm organizations={orgs.map((o) => ({ id: o.id, name: o.name }))} />
    </div>
  );
}
