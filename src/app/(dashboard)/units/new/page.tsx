import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { UnitForm } from "@/components/units/unit-form";
import { requireRole } from "@/lib/auth/guards";
import { listBuildingOptions } from "@/lib/api/buildings";
import { listFloorOptions } from "@/lib/api/floors";

export const dynamic = "force-dynamic";

export default async function NewUnitPage({
  searchParams,
}: {
  searchParams: Promise<{ building?: string }>;
}) {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const sp = await searchParams;
  const buildings = await listBuildingOptions();
  if (buildings.length === 0) redirect("/buildings/new");

  // Pre-fetch floors for every building so the dropdown updates client-side
  // without an extra round-trip.
  const floorEntries = await Promise.all(
    buildings.map(async (b) => [b.id, await listFloorOptions(b.id)] as const),
  );
  const floorsByBuilding = Object.fromEntries(floorEntries);

  return (
    <div>
      <PageHeader title="Add unit" description="Create a unit inside a building." />
      <UnitForm buildings={buildings} floorsByBuilding={floorsByBuilding} defaultBuildingId={sp.building} />
    </div>
  );
}
