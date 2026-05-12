"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Optional i18n key under `headers.*`. If provided and translated, overrides `title`. */
  titleKey?: string;
  /** Optional i18n key under `headers.*`. If provided and translated, overrides `description`. */
  descKey?: string;
  actions?: React.ReactNode;
  className?: string;
}

function tr(t: (k: TranslationKey, p?: Record<string, string | number>) => string, key: string | undefined, fallback: string): string {
  if (!key) return fallback;
  const v = t(key as TranslationKey, {});
  return v && v !== key ? v : fallback;
}

export function PageHeader({ title, description, titleKey, descKey, actions, className }: PageHeaderProps) {
  const { t } = useT();
  return (
    <div className={cn("flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{tr(t, titleKey, title)}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{tr(t, descKey, description)}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
