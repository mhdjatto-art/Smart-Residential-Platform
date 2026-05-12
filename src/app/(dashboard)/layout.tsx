import { requireUser } from "@/lib/auth/guards";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { createClient } from "@/lib/supabase/server";

/**
 * Shell for every authenticated route.
 *
 * - `requireUser()` redirects to /login if there's no session.
 * - We resolve the user's primary organization for the topbar badge in a single
 *   round-trip. If the user belongs to multiple, this picks the first; a real
 *   org-switcher would live in a later phase.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const primaryRole = user.roles[0]?.role ?? null;
  const primaryOrgId =
    user.roles.find((r) => r.is_primary)?.organization_id ?? user.organizationIds[0] ?? null;

  let orgName: string | null = null;
  if (primaryOrgId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", primaryOrgId)
      .maybeSingle();
    orgName = data?.name ?? null;
  }

  const roleNames = user.roles.map((r) => r.role);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar roles={roleNames} isSuperAdmin={user.isSuperAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center lg:hidden">
          <div className="px-2">
            <MobileNav roles={roleNames} isSuperAdmin={user.isSuperAdmin} />
          </div>
          <div className="flex-1">
            <Topbar email={user.email} primaryRole={primaryRole} orgName={orgName} />
          </div>
        </div>
        <div className="hidden lg:block">
          <Topbar email={user.email} primaryRole={primaryRole} orgName={orgName} />
        </div>
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
