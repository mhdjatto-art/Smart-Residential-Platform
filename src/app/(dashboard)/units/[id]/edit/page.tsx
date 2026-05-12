import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { UnitForm } from "@/components/units/unit-form";
import { requireRole } from "@/lib/auth/guards";
import { getUnit } from "@/lib/api/units";
import { listBuildingOptions } from "@/lib/api/buildings";
import { listFloorOptions } from "@/lib/api/floors";

export const dynamic = "force-dynamic";

export default async function EditUnitPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const { id } = await params;
  const unit = await getUnit(id);
  if (!unit) notFound();

  const buildings = await listBuildingOptions();
  const floorEntries = await Promise.all(
    buildings.map(async (b) => [b.id, await listFloorOptions(b.id)] as const),
  );
  const floorsByBuilding = Object.fromEntries(floorEntries);

  return (
    <div>
      <PageHeader title={`Edit unit ${unit.unit_number}`} description="Update unit details." />
      <UnitForm
        buildings={buildings}
        floorsByBuilding={floorsByBuilding}
        initial={{
          id: unit.id,
          building_id: unit.building_id,
          floor_id: unit.floor_id ?? undefined,
          unit_number: unit.unit_number,
          unit_type: unit.unit_type as never,
          status: unit.status as never,
          ownership_status: unit.ownership_status as never,
          floor: unit.floor ?? undefined,
          area_sqm: unit.area_sqm ?? undefined,
          bedrooms: unit.bedrooms ?? undefined,
          bathrooms: unit.bathrooms ?? undefined,
          parking_slots: unit.parking_slots ?? undefined,
          purchase_price: unit.purchase_price ?? undefined,
          rent_price: unit.rent_price ?? undefined,
          maintenance_fee: unit.maintenance_fee ?? undefined,
          description: unit.description ?? undefined,
        }}
      />
    </div>
  );
}
