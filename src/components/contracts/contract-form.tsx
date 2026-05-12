"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { contractSchema, type ContractInput } from "@/lib/validations/contract";
import { createContract } from "@/lib/api/contracts";

interface UnitOption { id: string; unit_number: string; }
interface ResidentOption { id: string; full_name: string; }

interface ContractFormProps {
  units: UnitOption[];
  residents: ResidentOption[];
}

type Errors = Partial<Record<keyof ContractInput | "form", string>>;

export function ContractForm({ units, residents }: ContractFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const [showPenalty, setShowPenalty] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);

    const candidate: Record<string, unknown> = {
      unit_id: String(fd.get("unit_id") ?? ""),
      resident_id: String(fd.get("resident_id") ?? ""),
      contract_number: String(fd.get("contract_number") ?? ""),
      contract_type: String(fd.get("contract_type") ?? "property_sale"),
      contract_start_date: String(fd.get("contract_start_date") ?? ""),
      contract_end_date: String(fd.get("contract_end_date") ?? ""),
      total_property_price: String(fd.get("total_property_price") ?? ""),
      down_payment: String(fd.get("down_payment") ?? ""),
      installment_frequency: String(fd.get("installment_frequency") ?? "monthly"),
      installment_count: String(fd.get("installment_count") ?? ""),
      annual_interest_rate: String(fd.get("annual_interest_rate") ?? "0"),
      late_penalty_type: showPenalty ? String(fd.get("late_penalty_type") ?? "") : undefined,
      late_penalty_value: showPenalty ? String(fd.get("late_penalty_value") ?? "") : undefined,
      grace_period_days: String(fd.get("grace_period_days") ?? "0"),
      notes: String(fd.get("notes") ?? ""),
    };

    const parsed = contractSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Errors = {};
      for (const [k, v] of Object.entries(flat)) {
        next[k as keyof ContractInput] = (v ?? [])[0];
      }
      setErrors(next);
      return;
    }

    startTransition(async () => {
      try {
        const created = await createContract(parsed.data);
        toast.success("Contract created (draft)", { description: "Generate schedule on the detail page to activate." });
        router.push(`/contracts/${created.id}`);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setErrors({ form: msg });
        toast.error("Save failed", { description: msg });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-2">
          <Field label="Unit" error={errors.unit_id}>
            <Select name="unit_id" required>
              <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
              <SelectContent>
                {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.unit_number}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Resident" error={errors.resident_id}>
            <Select name="resident_id" required>
              <SelectTrigger><SelectValue placeholder="Select resident" /></SelectTrigger>
              <SelectContent>
                {residents.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Contract number" error={errors.contract_number}>
            <Input name="contract_number" placeholder="e.g. CT-2026-001" required />
          </Field>
          <Field label="Contract type" error={errors.contract_type}>
            <Select name="contract_type" defaultValue="property_sale">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="property_sale">Property sale</SelectItem>
                <SelectItem value="rental">Rental</SelectItem>
                <SelectItem value="lease_to_own">Lease to own</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Start date" error={errors.contract_start_date}>
            <Input type="date" name="contract_start_date" required />
          </Field>
          <Field label="End date (optional)" error={errors.contract_end_date}>
            <Input type="date" name="contract_end_date" />
          </Field>

          <Field label="Total property price" error={errors.total_property_price}>
            <Input type="number" step="0.01" name="total_property_price" required />
          </Field>
          <Field label="Down payment" error={errors.down_payment}>
            <Input type="number" step="0.01" name="down_payment" defaultValue="0" required />
          </Field>

          <Field label="Frequency" error={errors.installment_frequency}>
            <Select name="installment_frequency" defaultValue="monthly">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="biannual">Biannual</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Number of installments" error={errors.installment_count}>
            <Input type="number" name="installment_count" min={1} max={600} required />
          </Field>

          <Field label="Annual interest rate (%)" error={errors.annual_interest_rate}>
            <Input type="number" step="0.01" name="annual_interest_rate" defaultValue="0" />
          </Field>

          <Field label="" error={undefined}>
            <label className="flex items-center gap-2 text-sm pt-7">
              <input type="checkbox" checked={showPenalty} onChange={(e) => setShowPenalty(e.target.checked)} />
              Configure late payment penalty
            </label>
          </Field>

          {showPenalty && (
            <>
              <Field label="Penalty type" error={errors.late_penalty_type}>
                <Select name="late_penalty_type" defaultValue="fixed">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                    <SelectItem value="percentage">% of installment</SelectItem>
                    <SelectItem value="daily">Daily fee</SelectItem>
                    <SelectItem value="monthly">Monthly fee</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Penalty value" error={errors.late_penalty_value}>
                <Input type="number" step="0.01" name="late_penalty_value" required />
              </Field>
              <Field label="Grace period (days)" error={errors.grace_period_days}>
                <Input type="number" name="grace_period_days" defaultValue="0" />
              </Field>
            </>
          )}

          <Field label="Notes" error={errors.notes} className="md:col-span-2">
            <textarea
              name="notes"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
        </CardContent>
      </Card>

      {errors.form && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errors.form}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create draft contract"}
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
      {label && <Label>{label}</Label>}
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
