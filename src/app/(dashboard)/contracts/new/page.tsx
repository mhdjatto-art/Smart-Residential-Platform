import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ContractForm } from "@/components/contracts/contract-form";
import { requireRole } from "@/lib/auth/guards";
import { listUnitsPaged } from "@/lib/api/units";
import { listResidentOptions } from "@/lib/api/residents";

export const dynamic = "force-dynamic";

export default async function NewContractPage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);

  const [units, residents] = await Promise.all([
    listUnitsPaged({ pageSize: 500 }),
    listResidentOptions(),
  ]);

  if (units.data.length === 0 || residents.length === 0) {
    redirect(units.data.length === 0 ? "/units/new" : "/residents/new");
  }

  return (
    <div>
      <PageHeader
        title="New contract"
        description="Create a draft contract. You'll generate the schedule and activate it next."
      />
      <ContractForm
        units={units.data.map((u) => ({ id: u.id, unit_number: u.unit_number }))}
        residents={residents}
      />
    </div>
  );
}
