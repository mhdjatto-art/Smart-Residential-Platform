"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { payUtilityBill, type PaymentInput } from "@/lib/api/utility-bill-actions";
import { formatCurrency } from "@/lib/utils";

interface PayBillDialogProps {
  billId: string;
  billNumber: string;
  totalAmount: number;
  penaltyAmount: number;
  paidAmount: number;
  currency: string;
}

const METHODS = [
  { value: "cash",           label: "Cash" },
  { value: "bank_transfer",  label: "Bank transfer" },
  { value: "online_payment", label: "Online" },
  { value: "wallet",         label: "Wallet" },
  { value: "cheque",         label: "Cheque" },
] as const;

export function PayBillDialog({ billId, billNumber, totalAmount, penaltyAmount, paidAmount, currency }: PayBillDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const owed = Math.max(0, totalAmount + (penaltyAmount ?? 0) - (paidAmount ?? 0));
  const [amount, setAmount] = useState<number>(Number(owed.toFixed(2)));
  const [method, setMethod] = useState<PaymentInput["method"]>("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (amount <= 0) { toast.error("Amount must be > 0"); return; }
    startTransition(async () => {
      try {
        await payUtilityBill({ bill_id: billId, amount, method, reference: reference || undefined, notes: notes || undefined });
        toast.success("Payment recorded");
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error("Payment failed", { description: err instanceof Error ? err.message : "Unknown error" });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CreditCard className="h-3.5 w-3.5" /> Pay
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay bill {billNumber}</DialogTitle>
          <DialogDescription>
            Owed: <strong>{formatCurrency(owed, { currency })}</strong>
            {penaltyAmount > 0 && (
              <span className="ml-2 text-xs text-amber-600">
                (includes {formatCurrency(penaltyAmount, { currency })} penalty)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="flex gap-2">
              <Input id="amount" type="number" min={0} step="0.01" max={owed}
                value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
              <Button type="button" size="sm" variant="outline"
                onClick={() => setAmount(Number(owed.toFixed(2)))}>
                Full
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Method</Label>
            <select id="method"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={method} onChange={(e) => setMethod(e.target.value as PaymentInput["method"])}>
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Reference (optional)</Label>
            <Input id="reference" placeholder="bank ref / cheque #"
              value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? "Recording…" : `Record ${formatCurrency(amount, { currency })}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
