"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, BellOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateReminders, dismissReminder } from "@/lib/api/reminders";

export function GenerateButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const n = await generateReminders(7);
        toast.success(n > 0 ? `Generated ${n} new reminder(s)` : "No new reminders to generate");
        router.refresh();
      } catch (e) {
        toast.error("Failed", { description: e instanceof Error ? e.message : "" });
      }
    });
  }

  return (
    <Button onClick={run} disabled={pending}>
      <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} /> Generate reminders
    </Button>
  );
}

export function DismissButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        await dismissReminder(id);
        toast.success("Dismissed");
        router.refresh();
      } catch (e) {
        toast.error("Failed", { description: e instanceof Error ? e.message : "" });
      }
    });
  }

  return (
    <Button variant="ghost" size="icon" onClick={run} disabled={pending} aria-label="Dismiss">
      <BellOff className="h-4 w-4 text-muted-foreground" />
    </Button>
  );
}

export { Bell };
