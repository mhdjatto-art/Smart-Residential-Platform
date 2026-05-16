"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { paymentSchema, type PaymentInput } from "@/lib/validations/contract";
import { recordPayment } from "@/lib/api/payments";
import { formatCurrency } from "@/lib/utils";

interface PaymentFormProps {
  contractId: string;
  outstandingTotal: number;
  nextDueAmount: number | null;
  currency?: string;
}

type Errors = Partial<Record<keyof PaymentInput | "form", string>>;

export function PaymentForm({ contractId, outstandingTotal, nextDueAmount, currency = "IQD" }: PaymentFormProps) {
  const fmt = (n: number) => formatCurrency(n, { currency });
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Errors>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const candidate = {
      contract_id: contractId,
      amount: String(fd.get("amount") ?? ""),
      payment_method: String(fd.get("payment_method") ?? "cash"),
      payment_date: String(fd.get("payment_date") ?? new Date().toISOString().slice(0, 10)),
      external_reference: String(fd.get("external_reference") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    };

    const parsed = paymentSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Errors = {};
      for (const [k, v] of Object.entries(flat)) {
        next[k as keyof PaymentInput] = (v ?? [])[0];
      }
      setErrors(next);
      return;
    }
    if (parsed.data.amount > outstandingTotal + 0.01) {
      setErrors({ amount: `Amount exceeds outstanding ${fmt(outstandingTotal)}` });
      return;
    }

    startTransition(async () => {
      try {
        await recordPayment(parsed.data);
        toast.success("Payment recorded", { description: `Receipt generated automatically.` });
        router.push(`/contracts/${contractId}`);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setErrors({ form: msg });
        toast.error("Payment failed", { description: msg });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-2">
          <div className="md:col-span-2 grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <div>
              <p className="text-xs uppercase text-muted-foreground tracking-wider">Outstanding total</p>
              <p className="mt-1 font-semibold">{fmt(outstandingTotal)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground tracking-wider">Next installment due</p>
              <p className="mt-1 font-semibold">{nextDueAmount !== null ? fmt(nextDueAmount) : "—"}</p>
            </div>
          </div>

          <Field label="Amount" error={errors.amount}>
            <Input
              type="number" step="0.01" name="amount" required
              defaultValue={nextDueAmount !== null ? nextDueAmount.toFixed(2) : ""}
              placeholder="0.00"
            />
          </Field>
          <Field label="Payment date" error={errors.payment_date}>
            <Input type="date" name="payment_date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          </Field>

          <Field label="Method" error={errors.payment_method}>
            <Select name="payment_method" defaultValue="cash">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                <SelectItem value="online_payment">Online payment</SelectItem>
                <SelectItem value="wallet">Wallet</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="External reference (optional)" error={errors.external_reference}>
            <Input name="external_reference" placeholder="Bank ref, cheque #, etc." />
          </Field>

          <Field label="Notes" error={errors.notes} className="md:col-span-2">
            <textarea
              name="notes"
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
        </CardContent>
      </Card>

      {errors.form && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errors.form}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Processing…" : "Record payment"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label, error, children, className,
}: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
