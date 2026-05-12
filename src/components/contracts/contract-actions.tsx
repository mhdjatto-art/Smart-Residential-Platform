"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calculator, PlayCircle, AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateSchedule, activateContract, applyPenalties } from "@/lib/api/contracts";

interface ContractActionsProps {
  contractId: string;
  status: string;
  hasSchedule: boolean;
}

export function ContractActions({ contractId, status, hasSchedule }: ContractActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function doGenerate() {
    if (hasSchedule && !confirm("Replace existing draft schedule?")) return;
    startTransition(async () => {
      try {
        const n = await generateSchedule(contractId);
        toast.success(`Generated ${n} installments`);
        router.refresh();
      } catch (e) {
        toast.error("Could not generate", { description: e instanceof Error ? e.message : "" });
      }
    });
  }

  function doActivate() {
    if (!confirm("Activate this contract? Once active, the schedule is frozen and cannot be regenerated.")) return;
    startTransition(async () => {
      try {
        await activateContract(contractId);
        toast.success("Contract activated");
        router.refresh();
      } catch (e) {
        toast.error("Could not activate", { description: e instanceof Error ? e.message : "" });
      }
    });
  }

  function doPenalties() {
    startTransition(async () => {
      try {
        const n = await applyPenalties(contractId);
        toast.success(n > 0 ? `Applied ${n} penalty(s)` : "No new penalties");
        router.refresh();
      } catch (e) {
        toast.error("Could not apply penalties", { description: e instanceof Error ? e.message : "" });
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" && (
        <>
          <Button variant="outline" size="sm" onClick={doGenerate} disabled={pending}>
            <Calculator className="h-4 w-4" /> {hasSchedule ? "Regenerate schedule" : "Generate schedule"}
          </Button>
          {hasSchedule && (
            <Button size="sm" onClick={doActivate} disabled={pending}>
              <PlayCircle className="h-4 w-4" /> Activate contract
            </Button>
          )}
        </>
      )}
      {status === "active" && (
        <Button variant="outline" size="sm" onClick={doPenalties} disabled={pending}>
          <AlertOctagon className="h-4 w-4" /> Apply penalties
        </Button>
      )}
    </div>
  );
}
