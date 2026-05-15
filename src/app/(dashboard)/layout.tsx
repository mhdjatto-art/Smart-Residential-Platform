import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { BrandingProvider, getActiveBranding } from "@/components/layout/branding-provider";
import { createClient } from "@/lib/supabase/server";
import { getActiveLocale } from "@/lib/i18n/server";
import { getEffectiveCapabilities } from "@/lib/auth/effective-permissions";
import { getEnabledFeatures } from "@/lib/auth/feature-flags";
import { getPostLoginPath, ROUTES } from "@/lib/auth/post-login-redirect";

export const dynamic = "force-dynamic";

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
  const locale = await getActiveLocale();

  const roleNames = user.roles.map((r) => r.role);
  // Residents (and ONLY residents) should never see the admin dashboard.
  // Redirect them to the mobile shell. Super admins / staff with the resident
  // role alongside admin roles still see the dashboard.
  const landing = getPostLoginPath(roleNames);
  if (landing === ROUTES.RESIDENT_HOME) {
    redirect(ROUTES.RESIDENT_HOME);
  }

  const primaryRole = user.roles[0]?.role ?? null;
  const primaryOrgId =
    user.roles.find((r) => r.is_primary)?.organization_id ?? user.organizationIds[0] ?? null;

  let orgName: string | null = null;
  if (primaryOrgId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", primaryOrgId)
      .maybeSingle();
    orgName = data?.name ?? null;
  }

  // Initial unread count for the bell — best-effort, falls back to 0
  let initialUnread = 0;
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    initialUnread = count ?? 0;
  } catch (e) {
    console.error("[dashboard-layout] unread count failed:", e instanceof Error ? e.message : String(e));
  }

  const branding = await getActiveBranding(primaryOrgId);
  const logoUrl = branding?.logo_path ?? null;

  // Phase 17 — load effective capability set and enabled features so the
  // Sidebar / MobileNav can gate items by both role overrides and feature flags.
  let effectiveCaps: readonly import("@/lib/auth/permissions").Capability[] = [];
  let enabledFeatures: readonly string[] = [];
  try {
    const [caps, feats] = await Promise.all([
      getEffectiveCapabilities(roleNames, primaryOrgId),
      getEnabledFeatures(primaryOrgId),
    ]);
    effectiveCaps = Array.from(caps);
    enabledFeatures = Array.from(feats);
  } catch (e) {
    console.error("[dashboard-layout] phase17 enforcement load failed:", e instanceof Error ? e.message : String(e));
  }

  return (
    <BrandingProvider orgId={primaryOrgId}>
      <div className="flex min-h-screen bg-muted/30">
        <Sidebar
          roles={roleNames}
          isSuperAdmin={user.isSuperAdmin}
          effectiveCapabilities={effectiveCaps}
          enabledFeatures={enabledFeatures}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center lg:hidden">
            <div className="px-2">
              <MobileNav
                roles={roleNames}
                isSuperAdmin={user.isSuperAdmin}
                effectiveCapabilities={effectiveCaps}
                enabledFeatures={enabledFeatures}
              />
            </div>
            <div className="flex-1">
              <Topbar email={user.email} primaryRole={primaryRole} orgName={orgName} locale={locale} userId={user.id} initialUnread={initialUnread} logoUrl={logoUrl} />
            </div>
          </div>
          <div className="hidden lg:block">
            <Topbar email={user.email} primaryRole={primaryRole} orgName={orgName} locale={locale} userId={user.id} initialUnread={initialUnread} logoUrl={logoUrl} />
          </div>
          <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </BrandingProvider>
  );
}
