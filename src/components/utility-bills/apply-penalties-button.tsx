"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyUtilityPenalties, type PenaltyRunSummary } from "@/lib/api/utility-bill-actions";

export function ApplyPenaltiesButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [last, setLast] = useState<PenaltyRunSummary | null>(null);

  function run() {
    if (!confirm("Apply late penalties to every overdue bill?\n\nRate: 2% per week\nGrace: 7 days after due date")) return;
    startTransition(async () => {
      try {
        const summary = await applyUtilityPenalties(0.02, 7);
        setLast(summary);
        toast.success("Penalties applied", {
          description: `${summary.applied} bills · ${summary.total_penalty.toFixed(2)} total`,
        });
        router.refresh();
      } catch (err) {
        toast.error("Penalty run failed", { description: err instanceof Error ? err.message : "Unknown error" });
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={run} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
        Apply penalties
      </Button>
      {last && (
        <span className="text-xs text-muted-foreground">
          Last: {last.applied} bills, {last.total_penalty.toFixed(2)} total
        </span>
      )}
    </div>
  );
}
