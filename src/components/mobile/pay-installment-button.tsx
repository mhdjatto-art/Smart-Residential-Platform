"use client";

/**
 * Phase 20 — Resident-facing "Pay" button for an installment / rent schedule row.
 *
 * Mirrors PayBillButton (utility bills) but routes through
 * /lib/api/resident-installment-payments.ts and
 * /lib/api/checkout.startInstallmentCheckout for online card payment.
 */

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
import { payMyInstallment } from "@/lib/api/resident-installment-payments";
import { startInstallmentCheckout } from "@/lib/api/checkout";
import { formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

interface PayInstallmentButtonProps {
  installmentId:     string;
  installmentNumber: number;
  contractKind:      "installments" | "rent";  // controls button label
  totalDue:          number;
  paidAmount:        number;
  penaltyAmount:     number;
  currency:          string;
}

export function PayInstallmentButton({
  installmentId, installmentNumber, contractKind, totalDue, paidAmount, penaltyAmount, currency,
}: PayInstallmentButtonProps) {
  const router = useRouter();
  const { t } = useT();
  const owed = Math.max(0, totalDue + (penaltyAmount ?? 0) - (paidAmount ?? 0));
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(Number(owed.toFixed(2)));
  const [method, setMethod] = useState<"online_payment" | "wallet">("online_payment");
  const [pending, startTransition] = useTransition();

  if (owed <= 0) return null;

  function submit() {
    if (amount <= 0) { toast.error(t("mobile.amount_must_be_positive")); return; }
    startTransition(async () => {
      try {
        // Try Stripe first if configured
        if (method === "online_payment") {
          const result = await startInstallmentCheckout(installmentId, amount);
          if (result.error) {
            toast.error(t("mobile.payment_failed"), { description: result.error });
            return;
          }
          if (result.url) {
            window.location.href = result.url;
            return;
          }
          // Stripe not configured → fall through to direct record
        }

        // Wallet OR Stripe-not-configured fallback
        await payMyInstallment({ installment_id: installmentId, amount, method });
        toast.success(t("mobile.payment_recorded"));
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(t("mobile.payment_failed"), {
          description: e instanceof Error ? e.message : "Unknown error",
        });
      }
    });
  }

  const label = contractKind === "rent" ? t("mobile.pay_rent") : t("mobile.pay_installment");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full px-3 text-xs">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {contractKind === "rent"
              ? t("mobile.rent_period_n", { n: installmentNumber })
              : t("mobile.installment_n", { n: installmentNumber })}
          </DialogTitle>
          <DialogDescription>
            {t("mobile.pay_dialog_desc", { amount: formatCurrency(owed, { currency }) })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">{t("mobile.amount")}</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={owed}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              {t("mobile.max_payable", { amount: formatCurrency(owed, { currency }) })}
            </p>
          </div>

          {/* Method picker */}
          <div className="space-y-1.5">
            <Label>{t("mobile.payment_method")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod("online_payment")}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition ${
                  method === "online_payment" ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted/50"
                }`}
              >
                <CreditCard className="h-5 w-5" />
                {t("mobile.method_card")}
              </button>
              <button
                type="button"
                onClick={() => setMethod("wallet")}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition ${
                  method === "wallet" ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted/50"
                }`}
              >
                <Wallet className="h-5 w-5" />
                {t("mobile.method_wallet")}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {t("actions.cancel")}
          </Button>
          <Button onClick={submit} disabled={pending || amount <= 0}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("mobile.confirm_pay", { amount: formatCurrency(amount || 0, { currency }) })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
