"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n";

interface PageHeaderProps {
  title?: string;
  description?: string;
  /** Optional i18n key under `headers.*`. If provided and translated, overrides `title`. */
  titleKey?: string;
  /** Optional i18n key under `headers.*`. If provided and translated, overrides `description`. */
  descKey?: string;
  actions?: React.ReactNode;
  className?: string;
}

function tr(
  t: (k: TranslationKey, p?: Record<string, string | number>) => string,
  key: string | undefined,
  fallback: string | undefined,
): string {
  if (!key) return fallback ?? "";
  const v = t(key as TranslationKey, {});
  return v && v !== key ? v : (fallback ?? "");
}

export function PageHeader({ title, description, titleKey, descKey, actions, className }: PageHeaderProps) {
  const { t } = useT();
  const resolvedTitle = tr(t, titleKey, title);
  const resolvedDesc = tr(t, descKey, description);
  return (
    <div className={cn("flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        {resolvedTitle && <h1 className="text-2xl font-bold tracking-tight">{resolvedTitle}</h1>}
        {resolvedDesc && <p className="mt-1 text-sm text-muted-foreground">{resolvedDesc}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
