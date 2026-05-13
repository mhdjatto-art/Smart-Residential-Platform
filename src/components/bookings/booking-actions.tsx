"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { approveBooking, rejectBooking } from "@/lib/api/facilities";

interface Props {
  bookingId: string;
  status: string;
}

export function BookingActions({ bookingId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  function approve() {
    startTransition(async () => {
      try {
        await approveBooking(bookingId);
        toast.success("Booking approved");
        router.refresh();
      } catch (err) {
        toast.error("Approve failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  function reject() {
    if (!reason.trim()) { toast.error("Provide a reason"); return; }
    startTransition(async () => {
      try {
        await rejectBooking(bookingId, reason.trim());
        toast.success("Booking rejected");
        setRejectOpen(false);
        setReason("");
        router.refresh();
      } catch (err) {
        toast.error("Reject failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  if (status !== "pending") return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div className="flex gap-1">
      <Button size="sm" variant="default" onClick={approve} disabled={pending} className="h-7 px-2 text-xs">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Approve
      </Button>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="destructive" disabled={pending} className="h-7 px-2 text-xs">
            <X className="h-3.5 w-3.5" /> Reject
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject booking</DialogTitle>
            <DialogDescription>Provide a reason that will be shown to the resident.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Facility under maintenance" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={pending}>Cancel</Button>
            <Button variant="destructive" onClick={reject} disabled={pending || !reason.trim()}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
