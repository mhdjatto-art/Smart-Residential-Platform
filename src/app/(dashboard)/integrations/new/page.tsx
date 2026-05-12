import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { IntegrationForm } from "@/components/pricing/integration-form";
import { requireRole } from "@/lib/auth/guards";
import { listOrganizations } from "@/lib/api/organizations";

export const dynamic = "force-dynamic";

export default async function NewIntegrationPage() {
  await requireRole(["super_admin","developer_admin"]);
  const orgs = await listOrganizations();
  if (orgs.length === 0) redirect("/organizations");
  return (
    <div>
      <PageHeader title="New integration" description="Connect a provider adapter (Mikrotik, UniFi, Modbus, REST, …)." />
      <IntegrationForm organizations={orgs.map((o) => ({ id: o.id, name: o.name }))} />
    </div>
  );
}
