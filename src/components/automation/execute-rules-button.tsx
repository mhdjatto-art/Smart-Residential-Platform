"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { executeDueRulesNow } from "@/lib/api/automation";

export function ExecuteRulesButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      onClick={() => startTransition(async () => {
        try {
          const n = await executeDueRulesNow();
          toast.success(`Executed ${n} due rule${n === 1 ? "" : "s"}`);
          router.refresh();
        } catch (err) {
          toast.error("Failed", { description: err instanceof Error ? err.message : "" });
        }
      })}
      disabled={pending}
    >
      <Zap className={`h-4 w-4 ${pending ? "animate-pulse" : ""}`} />
      {pending ? "Running…" : "Run due rules"}
    </Button>
  );
}
