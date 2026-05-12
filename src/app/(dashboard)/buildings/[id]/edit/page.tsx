import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { BuildingForm } from "@/components/buildings/building-form";
import { requireRole } from "@/lib/auth/guards";
import { getBuilding } from "@/lib/api/buildings";
import { listCompoundOptions } from "@/lib/api/compounds";

export const dynamic = "force-dynamic";

export default async function EditBuildingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const { id } = await params;
  const [building, compounds] = await Promise.all([getBuilding(id), listCompoundOptions()]);
  if (!building) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${building.name}`} description="Update building details." />
      <BuildingForm
        compounds={compounds}
        initial={{
          id: building.id,
          compound_id: building.compound_id,
          name: building.name,
          code: building.code ?? undefined,
          number_of_floors: building.number_of_floors ?? undefined,
          description: building.description ?? undefined,
          status: building.status as "active" | "inactive" | "under_construction",
        }}
      />
    </div>
  );
}
