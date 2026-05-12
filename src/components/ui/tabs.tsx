"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface Tab {
  value: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  paramName?: string;
  defaultValue?: string;
  className?: string;
}

/**
 * URL-synced tab bar. Renders <Link> items so navigation triggers Server
 * Component re-renders (data refresh "for free").
 */
export function Tabs({ tabs, paramName = "tab", defaultValue, className }: TabsProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(paramName) ?? defaultValue ?? tabs[0]?.value;

  return (
    <div className={cn("border-b", className)}>
      <nav className="flex gap-6">
        {tabs.map((t) => {
          const next = new URLSearchParams(params);
          if (t.value === (defaultValue ?? tabs[0]?.value)) next.delete(paramName);
          else next.set(paramName, t.value);
          const active = current === t.value;
          return (
            <Link
              key={t.value}
              href={`${pathname}?${next.toString()}`}
              className={cn(
                "border-b-2 -mb-px py-3 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
