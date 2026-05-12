import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusKind =
  | "active" | "inactive" | "archived" | "suspended"
  | "vacant" | "occupied" | "reserved" | "maintenance"
  | "pending" | "former"
  | "owned" | "for_sale" | "for_rent" | "leased"
  | "under_construction"
  | "ended" | "cancelled";

const KIND_TO_VARIANT: Record<StatusKind, BadgeProps["variant"]> = {
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
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = (KIND_TO_VARIANT as Record<string, BadgeProps["variant"]>)[status] ?? "outline";
  const label = status.replace(/_/g, " ");
  return (
    <Badge variant={variant} className={cn("capitalize", className)}>
      {label}
    </Badge>
  );
}
