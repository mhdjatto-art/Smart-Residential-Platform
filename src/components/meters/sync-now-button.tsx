"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Sync now" — calls POST /api/meters/<id>/sync. The worker resolves the
 * meter's adapter, pulls a reading, deducts from the wallet, and cuts off
 * if applicable. The response carries a per-meter detail object.
 */
export function SyncNowButton({ meterId }: { meterId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function go() {
    startTransition(async () => {
      try {
        const r = await fetch(`/api/meters/${meterId}/sync`, { method: "POST" });
        const json = await r.json().catch(() => ({}));
        if (!r.ok || !json.ok) {
          toast.error("Sync failed", { description: json?.detail?.message ?? json?.error ?? `HTTP ${r.status}` });
          return;
        }
        const d = json.detail;
        const parts = [
          `Adapter: ${d.adapter}`,
          d.reading_value !== undefined ? `Reading: ${d.reading_value}` : null,
          d.consumption ? `Consumption: ${d.consumption}` : null,
          d.deducted ? `Deducted: ${d.deducted}` : null,
          d.cutoff ? "⚠ Service cut off" : null,
        ].filter(Boolean).join(" · ");
        toast.success("Sync OK", { description: parts });
        router.refresh();
      } catch (e) {
        toast.error("Sync error", { description: e instanceof Error ? e.message : "Unknown" });
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={go} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Sync now
    </Button>
  );
}
