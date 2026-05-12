import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { TechnicianForm } from "@/components/technicians/technician-form";
import { requireRole } from "@/lib/auth/guards";
import { listOrganizations } from "@/lib/api/organizations";

export const dynamic = "force-dynamic";

export default async function NewTechnicianPage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const orgs = await listOrganizations();
  if (orgs.length === 0) redirect("/organizations");

  return (
    <div>
      <PageHeader title="Add technician" description="Create a maintenance staff profile." />
      <TechnicianForm organizations={orgs.map((o) => ({ id: o.id, name: o.name }))} />
    </div>
  );
}
