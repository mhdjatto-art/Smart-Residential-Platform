"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setAutomationStatus } from "@/lib/api/automation";

export function AutomationRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function update(next: "active" | "paused" | "disabled") {
    startTransition(async () => {
      try {
        await setAutomationStatus(id, next);
        toast.success(`Rule ${next}`);
        router.refresh();
      } catch (err) {
        toast.error("Failed", { description: err instanceof Error ? err.message : "" });
      }
    });
  }

  return (
    <div className="flex justify-end gap-1">
      {status !== "active"   && <Button size="sm" variant="outline" onClick={() => update("active")}   disabled={pending}><Play className="h-3 w-3" />Activate</Button>}
      {status === "active"   && <Button size="sm" variant="outline" onClick={() => update("paused")}   disabled={pending}><Pause className="h-3 w-3" />Pause</Button>}
      {status !== "disabled" && <Button size="sm" variant="ghost"   onClick={() => update("disabled")} disabled={pending}><X className="h-3 w-3" /></Button>}
    </div>
  );
}
