"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, ClipboardList, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n";

type NavItem = { href: string; label: string; i18nKey: string; icon: typeof Home; feature?: string };

const items: NavItem[] = [
  { href: "/m",             label: "Home",       i18nKey: "mobile.home",        icon: Home },
  { href: "/m/payments",    label: "Pay",        i18nKey: "mobile.pay",         icon: Wallet },
  { href: "/m/complaints",  label: "Complaints", i18nKey: "mobile.complaints",  icon: ClipboardList, feature: "tickets" },
  { href: "/m/marketplace", label: "Shop",       i18nKey: "mobile.shop",        icon: ShoppingBag,   feature: "marketplace" },
  { href: "/m/profile",     label: "Profile",    i18nKey: "mobile.profile",     icon: User },
];

interface BottomNavProps {
  /** Phase 17 enabled-feature keys (passed from the mobile layout). */
  enabledFeatures?: readonly string[];
}

export function BottomNav({ enabledFeatures }: BottomNavProps = {}) {
  const pathname = usePathname();
  const { t } = useT();
  const featSet = enabledFeatures ? new Set(enabledFeatures) : null;
  const isAllowed = (feature?: string) => {
    if (!feature) return true;
    if (!featSet) return true;
    if (featSet.size === 0) return true;
    return featSet.has(feature);
  };
  const visible = items.filter((it) => isAllowed(it.feature));
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_8px_-2px_rgba(0,0,0,0.08)]"
      role="navigation"
      aria-label="Primary"
    >
      <ul className={cn(
        "grid",
        visible.length === 2 && "grid-cols-2",
        visible.length === 3 && "grid-cols-3",
        visible.length === 4 && "grid-cols-4",
        visible.length === 5 && "grid-cols-5",
      )}>
        {visible.map((it) => {
          const active = pathname === it.href || (it.href !== "/m" && pathname?.startsWith(it.href));
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-all duration-200 active:scale-95",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {/* Active indicator dot above icon */}
                {active && (
                  <span className="absolute top-1 h-1 w-1 rounded-full bg-primary" aria-hidden />
                )}
                <span
                  className={cn(
                    "relative flex h-9 w-12 items-center justify-center rounded-full transition-all duration-200",
                    active && "bg-primary/10",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-all duration-200",
                      active ? "stroke-[2.5] scale-110" : "stroke-[2]",
                    )}
                  />
                </span>
                <span className={cn("transition-all", active && "font-semibold")}>
                  {(t(it.i18nKey as TranslationKey, {}) || it.label)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
