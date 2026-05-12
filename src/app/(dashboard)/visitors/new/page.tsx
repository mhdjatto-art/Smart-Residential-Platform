import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { VisitorForm } from "@/components/visitors/visitor-form";
import { requireUser } from "@/lib/auth/guards";
import { listResidentOptions } from "@/lib/api/residents";

export const dynamic = "force-dynamic";

export default async function NewVisitorPage() {
  await requireUser();
  const residents = await listResidentOptions();
  if (residents.length === 0) redirect("/residents/new");

  return (
    <div>
      <PageHeader title="Register visitor" description="Generate a visitor pass with QR code." />
      <VisitorForm residents={residents} />
    </div>
  );
}
