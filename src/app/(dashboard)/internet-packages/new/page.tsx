import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { InternetPackageForm } from "@/components/utilities/internet-package-form";
import { requireRole } from "@/lib/auth/guards";
import { listProviders } from "@/lib/api/utilities";

export const dynamic = "force-dynamic";

export default async function NewInternetPackagePage() {
  await requireRole(["super_admin","developer_admin","compound_manager","finance_officer"]);
  const providers = await listProviders();
  const internetProviders = providers.filter((p) => p.provider_type === "internet");
  if (internetProviders.length === 0) redirect("/providers/new");
  return (
    <div>
      <PageHeader title="New internet package" description="Define a plan that residents can subscribe to." />
      <InternetPackageForm providers={internetProviders.map((p) => ({ id: p.id, name: p.provider_name }))} />
    </div>
  );
}
