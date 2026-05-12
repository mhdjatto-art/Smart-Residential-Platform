import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { requireRole } from "@/lib/auth/guards";
import { listOrganizations, listCompounds } from "@/lib/api/organizations";

export const dynamic = "force-dynamic";

export default async function NewAnnouncementPage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const [orgs, compounds] = await Promise.all([listOrganizations(), listCompounds()]);
  if (orgs.length === 0) redirect("/organizations");

  return (
    <div>
      <PageHeader title="New announcement" description="Publish a notice to your community." />
      <AnnouncementForm
        organizations={orgs.map((o) => ({ id: o.id, name: o.name }))}
        compounds={compounds.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
