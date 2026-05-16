"use client";

/**
 * Phase 20B — Fast cash-recording dialog for the finance officer.
 * Skips the contract picker; we already know the installment + contract.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote, Building2, Landmark, Loader2, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { recordPayment } from "@/lib/api/payments";
import { formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface RecordCashButtonProps {
  contractId:        string;
  contractNumber:    string;
  residentName:      string;
  remaining:         number;
  installmentNumber: number;
  isRent:            boolean;
  currency:          string;
}

type CashMethod = "cash" | "bank_transfer" | "cheque" | "online_payment";

export function RecordCashButton({
  contractId, contractNumber, residentName, remaining, installmentNumber, isRent, currency,
}: RecordCashButtonProps) {
  const router = useRouter();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(Number(remaining.toFixed(2)));
  const [method, setMethod] = useState<CashMethod>("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (amount <= 0) { toast.error(t("cashier.amount_required")); return; }
    startTransition(async () => {
      try {
        await recordPayment({
          contract_id:        contractId,
          amount,
          payment_method:     method,
          payment_date:       new Date().toISOString().slice(0, 10),
          external_reference: reference.trim() || undefined,
          notes:              notes.trim() || undefined,
        });
        toast.success(t("cashier.recorded"), {
          description: `${residentName} · ${formatCurrency(amount, { currency })}`,
        });
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(t("cashier.record_failed"), { description: e instanceof Error ? e.message : "Unknown" });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full">
          <Banknote className="me-1 h-3.5 w-3.5" />
          {t("cashier.record")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isRent ? t("cashier.title_rent") : t("cashier.title_installment")}: #{installmentNumber}
          </DialogTitle>
          <DialogDescription>
            {residentName} · {contractNumber} · {t("cashier.outstanding")}: <b>{formatCurrency(remaining, { currency })}</b>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Method picker — Cash first since it's the default at the office */}
          <div className="space-y-1.5">
            <Label>{t("cashier.method")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <MethodTile icon={Banknote}   label={t("cashier.method_cash")}     active={method === "cash"}          onClick={() => setMethod("cash")} />
              <MethodTile icon={Landmark}   label={t("cashier.method_bank")}     active={method === "bank_transfer"} onClick={() => setMethod("bank_transfer")} />
              <MethodTile icon={ScrollText} label={t("cashier.method_cheque")}   active={method === "cheque"}        onClick={() => setMethod("cheque")} />
              <MethodTile icon={Building2}  label={t("cashier.method_online")}   active={method === "online_payment"} onClick={() => setMethod("online_payment")} />
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">{t("cashier.amount")}</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={remaining}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setAmount(Number(remaining.toFixed(2)))}
            >
              {t("cashier.fill_remaining")} ({formatCurrency(remaining, { currency })})
            </button>
          </div>

          {/* Reference — required for non-cash, optional for cash */}
          <div className="space-y-1.5">
            <Label htmlFor="reference">
              {t("cashier.reference")}
              {method !== "cash" && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={
                method === "cash"            ? t("cashier.reference_cash_placeholder")
              : method === "bank_transfer"   ? t("cashier.reference_bank_placeholder")
              : method === "cheque"          ? t("cashier.reference_cheque_placeholder")
                                              : t("cashier.reference_online_placeholder")
              }
            />
          </div>

          {/* Optional notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">{t("cashier.notes")}</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("cashier.notes_placeholder")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {t("actions.cancel")}
          </Button>
          <Button onClick={submit} disabled={pending || amount <= 0 || (method !== "cash" && !reference.trim())}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("cashier.confirm")} {formatCurrency(amount || 0, { currency })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MethodTile({
  icon: Icon, label, active, onClick,
}: {
  icon: typeof Banknote; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition active:scale-95",
        active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted/40",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
