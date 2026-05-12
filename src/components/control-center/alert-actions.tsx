"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateAlertStatus } from "@/lib/api/analytics";

interface AlertActionsProps { id: string; status: string; }

export function AlertActions({ id, status }: AlertActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setStatus(next: "acknowledged" | "resolved") {
    startTransition(async () => {
      try {
        await updateAlertStatus(id, next);
        toast.success(`Alert ${next}`);
        router.refresh();
      } catch (err) {
        toast.error("Failed", { description: err instanceof Error ? err.message : "" });
      }
    });
  }

  if (status === "resolved") return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex justify-end gap-1">
      {status === "open" && (
        <Button size="sm" variant="outline" onClick={() => setStatus("acknowledged")} disabled={pending}>Ack</Button>
      )}
      <Button size="sm" onClick={() => setStatus("resolved")} disabled={pending}>Resolve</Button>
    </div>
  );
}
