"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshExecutiveSnapshot } from "@/lib/api/analytics";

export function RefreshSnapshotButton({ hasData }: { hasData: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      onClick={() => startTransition(async () => {
        try {
          await refreshExecutiveSnapshot();
          toast.success("Snapshot refreshed");
          router.refresh();
        } catch (err) {
          toast.error("Refresh failed", { description: err instanceof Error ? err.message : "" });
        }
      })}
      disabled={pending}
      variant={hasData ? "outline" : "default"}
    >
      <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Refreshing…" : "Refresh now"}
    </Button>
  );
}
