import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MaintenanceForm } from "@/components/maintenance/maintenance-form";
import { requireRole } from "@/lib/auth/guards";
import { listCompoundOptions } from "@/lib/api/compounds";
import { listUnitOptions } from "@/lib/api/units";

export const metadata: Metadata = { title: "New maintenance job" };
export const dynamic = "force-dynamic";

export default async function NewMaintenancePage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "maintenance_staff"]);

  const [compounds, units] = await Promise.all([
    listCompoundOptions(),
    listUnitOptions(),
  ]);

  if (compounds.length === 0) {
    return (
      <div>
        <PageHeader title="New maintenance job" description="Create a work order." />
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No compounds yet — create one first.</p>
            <Button asChild className="mt-4"><Link href="/compounds/new">Add compound</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="New maintenance job"
        description="Create a corrective, preventive, or emergency work order. Assign a technician now or later."
      />
      <MaintenanceForm compounds={compounds} units={units} />
    </div>
  );
}
