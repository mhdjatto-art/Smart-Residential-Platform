import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FacilityForm } from "@/components/facilities/facility-form";
import { requireRole } from "@/lib/auth/guards";
import { listCompoundOptions } from "@/lib/api/compounds";

export const metadata: Metadata = { title: "New facility" };
export const dynamic = "force-dynamic";

export default async function NewFacilityPage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const compounds = await listCompoundOptions();

  if (compounds.length === 0) {
    return (
      <div>
        <PageHeader title="New facility" description="Add a facility residents can book." />
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Create a compound first.</p>
            <Button asChild className="mt-4"><Link href="/compounds/new">Add compound</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="New facility"
        description="Pool, gym, hall, court… anything residents can reserve. Set fees and approval policy."
      />
      <FacilityForm compounds={compounds} />
    </div>
  );
}
