import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ServiceProviderForm } from "@/components/marketplace/service-provider-form";
import { requireRole } from "@/lib/auth/guards";
import { listOrganizations } from "@/lib/api/organizations";

export const dynamic = "force-dynamic";

export default async function NewServiceProviderPage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const orgs = await listOrganizations();
  if (orgs.length === 0) redirect("/organizations");
  return (
    <div>
      <PageHeader titleKey="ops.add_service_provider_title" descKey="ops.add_service_provider_desc" />
      <ServiceProviderForm organizations={orgs.map((o) => ({ id: o.id, name: o.name }))} />
    </div>
  );
}
