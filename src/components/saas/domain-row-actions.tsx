"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setPrimaryDomain, deleteDomain } from "@/lib/api/saas";

export function DomainRowActions({ id, orgId, isPrimary }: { id: string; orgId: string; isPrimary: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex justify-end gap-1">
      {!isPrimary && (
        <Button size="sm" variant="outline" onClick={() => startTransition(async () => {
          try { await setPrimaryDomain(id, orgId); toast.success("Set as primary"); router.refresh(); }
          catch (err) { toast.error("Failed", { description: err instanceof Error ? err.message : "" }); }
        })} disabled={pending}>
          <Star className="h-3 w-3" />Make primary
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={() => {
        if (!confirm("Remove this domain?")) return;
        startTransition(async () => {
          try { await deleteDomain(id); toast.success("Removed"); router.refresh(); }
          catch (err) { toast.error("Failed", { description: err instanceof Error ? err.message : "" }); }
        });
      }} disabled={pending}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
