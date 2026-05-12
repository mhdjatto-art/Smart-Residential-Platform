import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ErpIntegrationForm } from "@/components/erp/erp-integration-form";
import { requireRole } from "@/lib/auth/guards";
import { listOrganizations } from "@/lib/api/organizations";

export const dynamic = "force-dynamic";

export default async function NewErpIntegrationPage() {
  await requireRole(["super_admin","developer_admin"]);
  const orgs = await listOrganizations();
  if (orgs.length === 0) redirect("/organizations");
  return (
    <div>
      <PageHeader title="Connect ERP" description="Bridge SRP to your accounting system." />
      <ErpIntegrationForm organizations={orgs.map((o) => ({ id: o.id, name: o.name }))} />
    </div>
  );
}
