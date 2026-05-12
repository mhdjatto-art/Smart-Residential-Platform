import { BottomNav } from "@/components/mobile/bottom-nav";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { requireSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

/**
 * Mobile shell. All `/m/*` routes share this layout — a bottom-nav, an
 * install prompt, and a safe-area padded scroll region. The desktop dashboard
 * shell (`(dashboard)/layout.tsx`) is unaffected.
 *
 * Auth is enforced by middleware too, but we double-check here so unauth'd
 * users see a clean redirect instead of a half-rendered shell.
 */
export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-screen-md">
        {children}
      </div>
      <InstallPrompt />
      <BottomNav />
    </div>
  );
}
