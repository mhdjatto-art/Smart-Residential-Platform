"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markRead, markAllRead } from "@/lib/api/notifications";

export function MarkAllReadButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run() {
    startTransition(async () => {
      try { await markAllRead(); toast.success("All marked read"); router.refresh(); }
      catch (e) { toast.error("Failed", { description: e instanceof Error ? e.message : "" }); }
    });
  }
  return (
    <Button variant="outline" size="sm" onClick={run} disabled={pending}>
      <CheckCheck className="h-4 w-4" /> Mark all read
    </Button>
  );
}

export function MarkOneReadButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run() {
    startTransition(async () => {
      try { await markRead(id); router.refresh(); }
      catch (e) { toast.error("Failed", { description: e instanceof Error ? e.message : "" }); }
    });
  }
  return (
    <Button variant="ghost" size="icon" onClick={run} disabled={pending} aria-label="Mark read">
      <Check className="h-4 w-4 text-muted-foreground" />
    </Button>
  );
}
