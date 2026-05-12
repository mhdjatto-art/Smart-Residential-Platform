"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateOrderStatus } from "@/lib/api/marketplace";

interface OrderActionsRowProps {
  orderId: string;
  status: string;
}

const NEXT_STATUS: Record<string, string | null> = {
  pending: "confirmed",
  confirmed: "assigned",
  assigned: "in_progress",
  in_progress: "completed",
};

export function OrderActionsRow({ orderId, status }: OrderActionsRowProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = NEXT_STATUS[status];
  const canCancel = !["completed", "cancelled", "refunded"].includes(status);

  function advance() {
    if (!next) return;
    startTransition(async () => {
      try {
        await updateOrderStatus(orderId, { order_status: next as never });
        toast.success(`Order → ${next}`);
        router.refresh();
      } catch (err) {
        toast.error("Failed", { description: err instanceof Error ? err.message : "" });
      }
    });
  }

  function cancel() {
    if (!confirm("Cancel this order?")) return;
    const reason = prompt("Cancellation reason (optional)") ?? "";
    startTransition(async () => {
      try {
        await updateOrderStatus(orderId, { order_status: "cancelled", cancellation_reason: reason });
        toast.success("Order cancelled");
        router.refresh();
      } catch (err) {
        toast.error("Failed", { description: err instanceof Error ? err.message : "" });
      }
    });
  }

  return (
    <div className="flex gap-2">
      {next && (
        <Button size="sm" onClick={advance} disabled={pending}>
          Advance → {next.replace("_", " ")}
        </Button>
      )}
      {canCancel && (
        <Button size="sm" variant="outline" onClick={cancel} disabled={pending}>Cancel</Button>
      )}
    </div>
  );
}
