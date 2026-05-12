"use client";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n";

const VARIANTS: Record<string, BadgeProps["variant"]> = {
  active: "success",
  inactive: "muted",
  archived: "muted",
  suspended: "destructive",
  vacant: "muted",
  occupied: "success",
  reserved: "warning",
  maintenance: "warning",
  pending: "warning",
  former: "muted",
  owned: "success",
  for_sale: "warning",
  for_rent: "warning",
  leased: "secondary",
  under_construction: "warning",
  ended: "muted",
  cancelled: "destructive",
  approved: "success",
  rejected: "destructive",
  open: "warning",
  closed: "muted",
  resolved: "success",
  in_progress: "warning",
  assigned: "secondary",
  completed: "success",
  confirmed: "success",
  draft: "muted",
  paid: "success",
  partial: "warning",
  overdue: "destructive",
  unpaid: "warning",
  refunded: "muted",
  verified: "success",
  unverified: "muted",
  busy: "warning",
  available: "success",
  trialing: "secondary",
  past_due: "destructive",
  expired: "destructive",
  checked_in: "success",
  checked_out: "muted",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useT();
  const variant = VARIANTS[status] ?? "outline";
  // Try `status.<value>` from the dict; fall back to humanized status.
  const translated = t(`status.${status}` as TranslationKey, {});
  const label = translated && translated !== `status.${status}` ? translated : status.replace(/_/g, " ");
  return (
    <Badge variant={variant} className={cn("capitalize", className)}>
      {label}
    </Badge>
  );
}
