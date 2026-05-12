"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { hasCapability, type Capability } from "@/lib/auth/permissions";
import { useT } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n";
import type { AppRole } from "@/types";
import { Home } from "lucide-react";

// href → i18n key under `nav.*`. Missing entries fall back to `item.title`.
const NAV_KEYS: Record<string, string> = {
  "/dashboard": "nav.dashboard",
  "/operations": "nav.operations",
  "/residents": "nav.residents",
  "/units": "nav.units",
  "/buildings": "nav.buildings",
  "/announcements": "nav.announcements",
  "/tickets": "nav.tickets",
  "/maintenance": "nav.maintenance",
  "/technicians": "nav.technicians",
  "/visitors": "nav.visitors",
  "/facilities": "nav.facilities",
  "/bookings": "nav.bookings",
  "/finance": "nav.finance",
  "/contracts": "nav.contracts",
  "/payments": "nav.payments",
  "/reminders": "nav.reminders",
  "/utilities": "nav.utilities",
  "/providers": "nav.providers",
  "/subscriptions": "nav.subscriptions",
  "/meters": "nav.meters",
  "/internet-packages": "nav.internet",
  "/utility-bills": "nav.utility_bills",
  "/marketplace": "nav.marketplace",
  "/service-providers": "nav.service_providers",
  "/orders": "nav.orders",
  "/reviews": "nav.reviews",
  "/control-center": "nav.control_center",
  "/analytics/risk": "nav.risk",
  "/automation": "nav.automation",
  "/alerts": "nav.alerts",
  "/audit-log": "nav.audit_log",
  "/compounds": "nav.compounds",
  "/organizations": "nav.organizations",
  "/settings/branding": "nav.branding",
  "/settings/domains": "nav.domains",
  "/settings/billing": "nav.billing",
  "/settings": "nav.settings",
  "/saas-console": "nav.saas_console",
  "/saas-console/plans": "nav.plans",
  "/saas-console/features": "nav.features",
};

interface SidebarProps {
  roles: AppRole[];
  isSuperAdmin: boolean;
}

export function Sidebar({ roles, isSuperAdmin }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useT();

  // super_admin sees everything regardless of roles array contents
  const can = (capability: Capability) =>
    isSuperAdmin || hasCapability(roles, capability);

  const tr = (key: string | undefined, fallback: string) =>
    key ? (t(key as TranslationKey, {}) || fallback) : fallback;

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r bg-card lg:flex">
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Home className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold leading-tight">{siteConfig.name}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {siteConfig.fullName}
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {navigation.map((section) => {
          const visible = section.items.filter((it) => can(it.requiredCapability));
          if (visible.length === 0) return null;
          return (
            <div key={section.title}>
              <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tr(section.i18nKey, section.title)}
              </div>
              <ul className="space-y-1">
                {visible.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground/70 hover:bg-muted hover:text-foreground",
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

      <div className="border-t p-4 text-[11px] text-muted-foreground">
        {siteConfig.tagline}
      </div>
    </aside>
  );
}
