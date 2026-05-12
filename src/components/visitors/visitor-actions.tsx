"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveVisitor, rejectVisitor, checkIn, checkOut } from "@/lib/api/visitors";

interface Props {
  visitorId: string;
  status: string;
}

export function VisitorActions({ visitorId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(label: string, action: () => Promise<void>) {
    startTransition(async () => {
      try {
        await action();
        toast.success(label);
        router.refresh();
      } catch (e) {
        toast.error("Failed", { description: e instanceof Error ? e.message : "" });
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending" && (
        <>
          <Button size="sm" onClick={() => run("Approved", () => approveVisitor(visitorId))} disabled={pending}>
            <Check className="h-4 w-4" /> Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => run("Rejected", () => rejectVisitor(visitorId))} disabled={pending}>
            <X className="h-4 w-4" /> Reject
          </Button>
        </>
      )}
      {status === "approved" && (
        <Button size="sm" onClick={() => run("Checked in", () => checkIn(visitorId))} disabled={pending}>
          <LogIn className="h-4 w-4" /> Check in
        </Button>
      )}
      {status === "checked_in" && (
        <Button size="sm" variant="outline" onClick={() => run("Checked out", () => checkOut(visitorId))} disabled={pending}>
          <LogOut className="h-4 w-4" /> Check out
        </Button>
      )}
    </div>
  );
}
