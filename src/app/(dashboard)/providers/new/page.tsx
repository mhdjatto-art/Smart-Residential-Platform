import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ProviderForm } from "@/components/providers/provider-form";
import { requireRole } from "@/lib/auth/guards";
import { listOrganizations } from "@/lib/api/organizations";

export const dynamic = "force-dynamic";

export default async function NewProviderPage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const orgs = await listOrganizations();
  if (orgs.length === 0) redirect("/organizations");
  return (
    <div>
      <PageHeader title="Add provider" description="Register a utility provider with future IoT-readiness." />
      <ProviderForm organizations={orgs.map((o) => ({ id: o.id, name: o.name }))} />
    </div>
  );
}
