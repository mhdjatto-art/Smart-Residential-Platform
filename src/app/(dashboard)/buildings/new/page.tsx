import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { BuildingForm } from "@/components/buildings/building-form";
import { requireRole } from "@/lib/auth/guards";
import { listCompoundOptions } from "@/lib/api/compounds";

export const dynamic = "force-dynamic";

export default async function NewBuildingPage({
  searchParams,
}: {
  searchParams: Promise<{ compound?: string }>;
}) {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const sp = await searchParams;
  const compounds = await listCompoundOptions();
  if (compounds.length === 0) redirect("/compounds/new");

  return (
    <div>
      <PageHeader title="Add building" description="Create a new building inside a compound." />
      <BuildingForm compounds={compounds} defaultCompoundId={sp.compound} />
    </div>
  );
}
