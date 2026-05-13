"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { payMyUtilityBill } from "@/lib/api/resident-payments";
import { startBillCheckout } from "@/lib/api/checkout";
import { formatCurrency } from "@/lib/utils";

interface PayBillButtonProps {
  billId: string;
  billNumber: string;
  utilityType: string;
  totalAmount: number;
  penaltyAmount: number;
  paidAmount: number;
  currency: string;
}

export function PayBillButton({
  billId, billNumber, utilityType, totalAmount, penaltyAmount, paidAmount, currency,
}: PayBillButtonProps) {
  const router = useRouter();
  const owed = Math.max(0, totalAmount + (penaltyAmount ?? 0) - (paidAmount ?? 0));
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(Number(owed.toFixed(2)));
  const [method, setMethod] = useState<"online_payment" | "wallet">("online_payment");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (amount <= 0) { toast.error("Amount must be > 0"); return; }
    startTransition(async () => {
      try {
        // For "Card / Online" try Stripe Checkout first
        if (method === "online_payment") {
          const result = await startBillCheckout(billId);
          if (result.error) {
            toast.error("Payment failed", { description: result.error });
            return;
          }
          if (result.url) {
            // Redirect to Stripe-hosted checkout
            window.location.href = result.url;
            return;
          }
          // Stripe not configured → fall through to direct pay (test mode)
          toast.message("Stripe not configured — recording payment directly (test mode)");
        }

        // Wallet OR Stripe fallback → record directly via SQL
        await payMyUtilityBill({ bill_id: billId, amount, method });
        toast.success("Payment recorded ✓");
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
        <Button size="sm" className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white">
          <CreditCard className="h-3.5 w-3.5" /> Pay
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="capitalize">{utilityType} bill</DialogTitle>
          <DialogDescription className="font-mono text-xs">{billNumber}</DialogDescription>
        </DialogHeader>

        {/* Hero amount */}
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-center text-white">
          <p className="text-xs uppercase tracking-wider opacity-90">Amount due</p>
          <p className="mt-1 text-3xl font-bold">{formatCurrency(owed, { currency })}</p>
          {penaltyAmount > 0 && (
            <p className="mt-1 text-[11px] opacity-80">
              includes {formatCurrency(penaltyAmount, { currency })} late fee
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="m-amount">Pay amount</Label>
            <div className="flex gap-2">
              <Input
                id="m-amount"
                type="number"
                min={0}
                step="0.01"
                max={owed}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="text-lg"
              />
              <Button type="button" size="sm" variant="outline" onClick={() => setAmount(Number(owed.toFixed(2)))}>
                Full
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Method</Label>
            <div className="grid grid-cols-2 gap-2">
              <MethodCard
                icon={CreditCard}
                label="Card / Online"
                selected={method === "online_payment"}
                onClick={() => setMethod("online_payment")}
              />
              <MethodCard
                icon={Wallet}
                label="Wallet"
                selected={method === "wallet"}
                onClick={() => setMethod("wallet")}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? "Processing…" : `Pay ${formatCurrency(amount, { currency })}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MethodCard({
  icon: Icon, label, selected, onClick,
}: { icon: typeof CreditCard; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-sm transition-colors ${
        selected
          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-card hover:bg-muted/50"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
