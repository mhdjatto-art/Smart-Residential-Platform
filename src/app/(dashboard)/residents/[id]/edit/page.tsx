import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ResidentForm } from "@/components/residents/resident-form";
import { requireRole } from "@/lib/auth/guards";
import { getResident } from "@/lib/api/residents";
import { listCompoundOptions } from "@/lib/api/compounds";

export const dynamic = "force-dynamic";

export default async function EditResidentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const { id } = await params;
  const [resident, compounds] = await Promise.all([getResident(id), listCompoundOptions()]);
  if (!resident) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${resident.first_name} ${resident.last_name}`} description="Update resident profile." />
      <ResidentForm
        compounds={compounds}
        initial={{
          id: resident.id,
          compound_id: resident.compound_id,
          first_name: resident.first_name,
          last_name: resident.last_name,
          email: resident.email ?? undefined,
          mobile: resident.mobile ?? resident.phone ?? undefined,
          phone: resident.phone ?? undefined,
          national_id: resident.national_id ?? undefined,
          gender: resident.gender as "male" | "female" | "unspecified",
          date_of_birth: resident.date_of_birth ?? undefined,
          occupation: resident.occupation ?? undefined,
          tenancy_type: resident.tenancy_type as "owner" | "tenant" | "family_member" | "guest",
          status: resident.status as "active" | "pending" | "former",
        }}
      />
    </div>
  );
}
