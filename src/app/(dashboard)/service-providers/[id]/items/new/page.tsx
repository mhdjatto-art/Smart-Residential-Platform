import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ServiceItemForm } from "@/components/marketplace/service-item-form";
import { requireRole } from "@/lib/auth/guards";
import { getServiceProvider, listServiceCategories } from "@/lib/api/marketplace";

export const dynamic = "force-dynamic";

export default async function NewServiceItemPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const { id } = await params;
  const provider = await getServiceProvider(id);
  if (!provider) notFound();
  const categories = await listServiceCategories();
  const orgCategories = categories.filter((c) => c.organization_id === provider.organization_id);

  return (
    <div>
      <PageHeader title="Add service / product" description={`To ${provider.provider_name}`} />
      <ServiceItemForm
        provider={{ id: provider.id, organization_id: provider.organization_id, provider_name: provider.provider_name }}
        categories={orgCategories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
