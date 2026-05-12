"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recomputeOverdueRisk } from "@/lib/api/analytics";

export function RecomputeRiskButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      onClick={() => startTransition(async () => {
        try {
          const n = await recomputeOverdueRisk();
          toast.success(`Scored ${n} residents`);
          router.refresh();
        } catch (err) {
          toast.error("Recompute failed", { description: err instanceof Error ? err.message : "" });
        }
      })}
      disabled={pending}
    >
      <Sparkles className={`h-4 w-4 ${pending ? "animate-pulse" : ""}`} />
      {pending ? "Scoring…" : "Recompute risk"}
    </Button>
  );
}
