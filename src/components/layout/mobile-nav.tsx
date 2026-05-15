"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Home } from "lucide-react";
import { navigation } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { hasCapability, type Capability } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n";
import type { AppRole } from "@/types";

const PLATFORM_HREFS = new Set([
  "/master/permissions",
  "/saas-console",
  "/saas-console/plans",
  "/saas-console/features",
]);

const NAV_KEYS: Record<string, string> = {
  "/dashboard":"nav.dashboard","/operations":"nav.operations","/residents":"nav.residents",
  "/units":"nav.units","/buildings":"nav.buildings","/announcements":"nav.announcements",
  "/tickets":"nav.tickets","/maintenance":"nav.maintenance","/technicians":"nav.technicians",
  "/visitors":"nav.visitors","/facilities":"nav.facilities","/bookings":"nav.bookings",
  "/finance":"nav.finance","/contracts":"nav.contracts","/payments":"nav.payments",
  "/reminders":"nav.reminders","/utilities":"nav.utilities","/providers":"nav.providers",
  "/subscriptions":"nav.subscriptions","/meters":"nav.meters","/internet-packages":"nav.internet",
  "/utility-bills":"nav.utility_bills","/marketplace":"nav.marketplace",
  "/service-providers":"nav.service_providers","/orders":"nav.orders","/reviews":"nav.reviews",
  "/control-center":"nav.control_center","/analytics/risk":"nav.risk","/automation":"nav.automation",
  "/alerts":"nav.alerts","/audit-log":"nav.audit_log","/compounds":"nav.compounds",
  "/organizations":"nav.organizations","/settings/branding":"nav.branding",
  "/settings/domains":"nav.domains","/settings/billing":"nav.billing","/settings":"nav.settings",
  "/saas-console":"nav.saas_console","/saas-console/plans":"nav.plans","/saas-console/features":"nav.features",
};

interface MobileNavProps {
  roles: AppRole[];
  isSuperAdmin: boolean;
  effectiveCapabilities?: readonly Capability[];
  enabledFeatures?: readonly string[];
}

/**
 * Drawer-style nav for screens below `lg`. Renders the same items as the
 * desktop Sidebar but in a slide-in panel triggered from the topbar area.
 */
export function MobileNav({ roles, isSuperAdmin, effectiveCapabilities, enabledFeatures }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useT();
  const tr = (k: string | undefined, fb: string) => k ? (t(k as TranslationKey, {}) || fb) : fb;

  const effSet = effectiveCapabilities ? new Set<Capability>(effectiveCapabilities) : null;
  const featSet = enabledFeatures ? new Set<string>(enabledFeatures) : null;

  const can = (cap: Capability) => {
    if (isSuperAdmin) return true;
    if (effSet) return effSet.has(cap);
    return hasCapability(roles, cap);
  };

  const featureAllowed = (href: string, feature: string | undefined) => {
    if (!feature) return true;
    if (PLATFORM_HREFS.has(href)) return true;
    if (!featSet) return true;
    if (featSet.size === 0) return true;
    return featSet.has(feature);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Toggle navigation"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-card shadow-xl">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Home className="h-4 w-4" />
                </div>
                <span className="text-sm font-bold">{siteConfig.name}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
              {navigation.map((section) => {
                const visible = section.items.filter(
                  (it) => can(it.requiredCapability) && featureAllowed(it.href, it.feature),
                );
                if (visible.length === 0) return null;
                return (
                  <div key={section.title}>
                    <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tr(`sections.${section.title.toLowerCase()}`, section.title)}
                    </div>
                    <ul className="space-y-1">
                      {visible.map((item) => {
                        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                        const Icon = item.icon;
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                                active
                                  ? "bg-primary text-primary-foreground"
                                  : "text-foreground/70 hover:bg-muted",
                              )}
                            >
                              <Icon className="h-4 w-4" />
                              {tr(NAV_KEYS[item.href] ?? item.i18nKey, item.title)}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
