import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { TicketForm } from "@/components/tickets/ticket-form";
import { requireUser, requireCapability } from "@/lib/auth/guards";
import { listCompoundOptions } from "@/lib/api/compounds";
import { listResidentOptions } from "@/lib/api/residents";
import { listUnitsPaged } from "@/lib/api/units";

export const dynamic = "force-dynamic";

export default async function NewTicketPage() {
  await requireCapability("ticket:read");
  await requireUser();
  const [compounds, residents, units] = await Promise.all([
    listCompoundOptions(),
    listResidentOptions(),
    listUnitsPaged({ pageSize: 500 }),
  ]);
  if (compounds.length === 0) redirect("/compounds/new");

  return (
    <div>
      <PageHeader titleKey="ops.new_ticket_title" descKey="ops.new_ticket_desc" />
      <TicketForm
        compounds={compounds}
        residents={residents}
        units={units.data.map((u) => ({ id: u.id, unit_number: u.unit_number }))}
      />
    </div>
  );
}
