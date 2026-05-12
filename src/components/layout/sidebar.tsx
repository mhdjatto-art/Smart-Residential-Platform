"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { hasCapability, type Capability } from "@/lib/auth/permissions";
import type { AppRole } from "@/types";
import { Home } from "lucide-react";

interface SidebarProps {
  roles: AppRole[];
  isSuperAdmin: boolean;
}

export function Sidebar({ roles, isSuperAdmin }: SidebarProps) {
  const pathname = usePathname();

  // super_admin sees everything regardless of roles array contents
  const can = (capability: Capability) =>
    isSuperAdmin || hasCapability(roles, capability);

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
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground/70 hover:bg-muted hover:text-foreground",
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

      <div className="border-t p-4 text-[11px] text-muted-foreground">
        {siteConfig.tagline}
      </div>
    </aside>
  );
}
