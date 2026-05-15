import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { UsersManager } from "@/components/admin/users-manager";
import { requireUser, requireCapability } from "@/lib/auth/guards";
import { listAdminUsers, listOrgOptions, listCompoundOptions } from "@/lib/api/admin-users";

export const metadata: Metadata = { title: "Users & permissions" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireCapability("user_role:write");
  const user = await requireUser();
  if (!user.isSuperAdmin) redirect("/dashboard");

  const [users, orgs, compounds] = await Promise.all([
    listAdminUsers(),
    listOrgOptions(),
    listCompoundOptions(),
  ]);

  return (
    <div>
      <PageHeader
        title="Users & permissions"
        description="Manage every auth user, their roles, and their organization/compound scope. Super-admin only."
      />
      <UsersManager users={users} orgs={orgs} compounds={compounds} />
    </div>
  );
}
