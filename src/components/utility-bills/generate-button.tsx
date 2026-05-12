"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateRecurringBills } from "@/lib/api/utilities";

export function GenerateRecurringButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const n = await generateRecurringBills();
        toast.success(n > 0 ? `Generated ${n} new bill(s)` : "All subscriptions up to date");
        router.refresh();
      } catch (e) {
        toast.error("Failed", { description: e instanceof Error ? e.message : "" });
      }
    });
  }

  return (
    <Button onClick={run} disabled={pending}>
      <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} /> Generate recurring bills
    </Button>
  );
}
