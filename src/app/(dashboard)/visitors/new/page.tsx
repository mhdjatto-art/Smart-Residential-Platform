import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { VisitorForm } from "@/components/visitors/visitor-form";
import { requireUser, requireCapability } from "@/lib/auth/guards";
import { listResidentOptions } from "@/lib/api/residents";

export const dynamic = "force-dynamic";

export default async function NewVisitorPage() {
  await requireCapability("visitor:read");
  await requireUser();
  const residents = await listResidentOptions();
  if (residents.length === 0) redirect("/residents/new");

  return (
    <div>
      <PageHeader titleKey="ops.register_visitor_title" descKey="ops.register_visitor_desc" />
      <VisitorForm residents={residents} />
    </div>
  );
}
