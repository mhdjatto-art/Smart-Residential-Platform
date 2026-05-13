import { BottomNav } from "@/components/mobile/bottom-nav";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { BrandingProvider, getActiveBranding } from "@/components/layout/branding-provider";
import { requireSession } from "@/lib/auth/guards";
import { getResidentContext } from "@/lib/api/resident-mobile";

export const dynamic = "force-dynamic";

/**
 * Mobile shell. All `/m/*` routes share this layout — a bottom-nav, an
 * install prompt, and a safe-area padded scroll region. The desktop dashboard
 * shell (`(dashboard)/layout.tsx`) is unaffected.
 *
 * Auth is enforced by middleware too, but we double-check here so unauth'd
 * users see a clean redirect instead of a half-rendered shell.
 *
 * Wraps children in <BrandingProvider> so the resident sees their compound's
 * white-label colors / favicon / custom CSS across every /m/* page.
 */
export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  let orgId: string | null = null;
  try {
    const ctx = await getResidentContext();
    orgId = ctx.organization_id;
  } catch {
    // Soft fail — not every authenticated user has a resident row
  }
  const branding = await getActiveBranding(orgId);
  const logoUrl = branding?.logo_path ?? null;

  return (
    <BrandingProvider orgId={orgId}>
      <div className="min-h-screen bg-background pb-20">
        <div className="mx-auto max-w-screen-md">
          {logoUrl && (
            <div className="flex justify-center border-b bg-card px-4 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="Logo" className="h-7 max-w-[180px] object-contain" />
            </div>
          )}
          {children}
        </div>
        <InstallPrompt />
        <BottomNav />
      </div>
    </BrandingProvider>
  );
}
