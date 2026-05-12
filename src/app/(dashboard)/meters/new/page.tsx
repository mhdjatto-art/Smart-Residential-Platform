import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MeterForm } from "@/components/meters/meter-form";
import { requireRole } from "@/lib/auth/guards";
import { listCompoundOptions } from "@/lib/api/compounds";
import { listUnitsPaged } from "@/lib/api/units";

export const dynamic = "force-dynamic";

export default async function NewMeterPage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "maintenance_staff"]);
  const [compounds, units] = await Promise.all([listCompoundOptions(), listUnitsPaged({ pageSize: 500 })]);
  if (compounds.length === 0) redirect("/compounds/new");

  return (
    <div>
      <PageHeader title="Add meter" description="Register an electricity meter for consumption tracking." />
      <MeterForm compounds={compounds} units={units.data.map((u) => ({ id: u.id, unit_number: u.unit_number }))} />
    </div>
  );
}
