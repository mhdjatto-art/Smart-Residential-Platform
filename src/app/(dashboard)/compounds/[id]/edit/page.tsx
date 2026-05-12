import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { CompoundForm } from "@/components/compounds/compound-form";
import { requireRole } from "@/lib/auth/guards";
import { getCompound } from "@/lib/api/compounds";
import { listOrganizations } from "@/lib/api/organizations";

export const dynamic = "force-dynamic";

export default async function EditCompoundPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const { id } = await params;
  const [compound, orgs] = await Promise.all([getCompound(id), listOrganizations()]);
  if (!compound) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${compound.name}`} description="Update compound details." />
      <CompoundForm
        organizations={orgs.map((o) => ({ id: o.id, name: o.name }))}
        initial={{
          id: compound.id,
          organization_id: compound.organization_id,
          name: compound.name,
          slug: compound.slug,
          code: compound.code ?? undefined,
          description: compound.description ?? undefined,
          status: compound.status as "active" | "inactive" | "archived",
          city: compound.city ?? undefined,
          region: compound.region ?? undefined,
          country_code: compound.country_code ?? undefined,
        }}
      />
    </div>
  );
}
