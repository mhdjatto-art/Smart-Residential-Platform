"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { topupWalletAction } from "@/lib/api/wallets";

interface Props { walletId: string; currency: string; }

/** Manager-initiated cash / bank-transfer / admin-credit top-up. */
export function ManagerTopupButton({ walletId, currency }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "bank_transfer" | "admin_credit">("cash");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    const a = Number(amount);
    if (!a || a <= 0) { toast.error("Amount > 0"); return; }
    startTransition(async () => {
      try {
        await topupWalletAction({
          walletId, amount: a, method,
          externalRef: ref || undefined,
          notes: notes || undefined,
        });
        toast.success("Top-up recorded");
        setOpen(false); setAmount(""); setRef(""); setNotes("");
        router.refresh();
      } catch (e) {
        toast.error("Failed", { description: e instanceof Error ? e.message : "Unknown" });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" />Record top-up</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual top-up</DialogTitle>
          <DialogDescription>For cash / bank transfer / admin credit only. Online methods go through the resident&apos;s self-service.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Amount ({currency})</Label>
            <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
          </div>
          <div>
            <Label>Method</Label>
            <select className="mt-1 flex h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value="cash">Cash (paid at office)</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="admin_credit">Admin credit (gift / adjustment)</option>
            </select>
          </div>
          <div>
            <Label>Reference (optional)</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="receipt # / transfer id" />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="reason" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
