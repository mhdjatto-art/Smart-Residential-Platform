"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { reversePayment } from "@/lib/api/payments";

interface ReverseButtonProps {
  paymentId: string;
}

export function ReverseButton({ paymentId }: ReverseButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (reason.trim().length < 3) {
      toast.error("Provide a reason (min 3 chars)");
      return;
    }
    startTransition(async () => {
      try {
        await reversePayment(paymentId, reason);
        toast.success("Payment reversed");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error("Reversal failed", { description: e instanceof Error ? e.message : "" });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Undo2 className="h-4 w-4" /> Reverse payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reverse this payment?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          The payment will be marked as reversed and its allocations rolled back.
          The original record is preserved in the audit log.
        </p>
        <div className="space-y-2">
          <Label>Reason</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. duplicate payment" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending ? "Reversing…" : "Reverse"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
