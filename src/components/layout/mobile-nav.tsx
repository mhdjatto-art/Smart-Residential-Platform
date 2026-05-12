"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Home } from "lucide-react";
import { navigation } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { hasCapability } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/types";

interface MobileNavProps {
  roles: AppRole[];
  isSuperAdmin: boolean;
}

/**
 * Drawer-style nav for screens below `lg`. Renders the same items as the
 * desktop Sidebar but in a slide-in panel triggered from the topbar area.
 */
export function MobileNav({ roles, isSuperAdmin }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const can = (cap: Parameters<typeof hasCapability>[1]) =>
    isSuperAdmin || hasCapability(roles, cap);

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
                const visible = section.items.filter((it) => can(it.requiredCapability));
                if (visible.length === 0) return null;
                return (
                  <div key={section.title}>
                    <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {section.title}
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
                              {item.title}
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
