"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, ClipboardList, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/m",            label: "Home",      icon: Home },
  { href: "/m/payments",   label: "Pay",       icon: Wallet },
  { href: "/m/complaints", label: "Complaints", icon: ClipboardList },
  { href: "/m/marketplace", label: "Shop",     icon: ShoppingBag },
  { href: "/m/profile",    label: "Profile",   icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {items.map((it) => {
          const active = pathname === it.href || (it.href !== "/m" && pathname?.startsWith(it.href));
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium",
                  active ? "text-emerald-600" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
