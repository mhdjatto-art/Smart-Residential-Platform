import { PageHeader } from "@/components/layout/page-header";
import { ResidentForm } from "@/components/residents/resident-form";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function NewResidentPage() {
  await requireRole(["developer_admin", "compound_manager"]);
  const supabase = await createClient();

  // Pull units the user can see, joined with building name so the dropdown
  // labels are meaningful.
  const { data, error } = await supabase
    .from("units")
    .select("id, unit_number, buildings(name)")
    .order("unit_number");

  if (error) throw new Error(error.message);

  const units = (data ?? []).map((u) => ({
    id: u.id,
    unit_number: u.unit_number,
    building_name:
      Array.isArray(u.buildings) ? u.buildings[0]?.name ?? "Unknown" : (u.buildings as { name?: string } | null)?.name ?? "Unknown",
  }));

  return (
    <div>
      <PageHeader title="Add resident" description="Create a new resident record and assign them to a unit." />
      <ResidentForm units={units} />
    </div>
  );
}
