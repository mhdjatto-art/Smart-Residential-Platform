"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, LogIn, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveVisitor, rejectVisitor, checkIn, checkOut } from "@/lib/api/visitors";

interface Props {
  visitorId: string;
  status: string;
  compact?: boolean;
}

const TRANSITIONS: Record<string, Array<"approve" | "reject" | "check_in" | "check_out">> = {
  pending:     ["approve", "reject"],
  approved:    ["check_in", "reject"],
  rejected:    ["approve"],
  checked_in:  ["check_out"],
  checked_out: [],
  expired:     [],
};

const META = {
  approve:   { label: "Approve",   icon: Check,  variant: "default" as const,     toast: "Approved" },
  reject:    { label: "Reject",    icon: X,      variant: "destructive" as const, toast: "Rejected" },
  check_in:  { label: "Check in",  icon: LogIn,  variant: "default" as const,     toast: "Checked in" },
  check_out: { label: "Check out", icon: LogOut, variant: "outline" as const,     toast: "Checked out" },
};

export function VisitorActions({ visitorId, status, compact }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const actions = TRANSITIONS[status] ?? [];

  function run(action: typeof actions[number]) {
    startTransition(async () => {
      try {
        switch (action) {
          case "approve":   await approveVisitor(visitorId); break;
          case "reject":    await rejectVisitor(visitorId);  break;
          case "check_in":  await checkIn(visitorId);        break;
          case "check_out": await checkOut(visitorId);       break;
        }
        toast.success(META[action].toast);
        router.refresh();
      } catch (err) {
        toast.error("Action failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  if (actions.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {actions.map((a) => {
        const m = META[a];
        const Icon = m.icon;
        return (
          <Button
            key={a}
            size="sm"
            variant={m.variant}
            onClick={() => run(a)}
            disabled={pending}
            className={compact ? "h-7 px-2 text-xs" : "h-8 px-2.5"}
            title={m.label}
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
            {!compact && <span>{m.label}</span>}
          </Button>
        );
      })}
    </div>
  );
}
