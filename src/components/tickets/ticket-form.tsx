"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ticketSchema, TICKET_CATEGORIES, type TicketInput } from "@/lib/validations/operations";
import { createTicket } from "@/lib/api/tickets";
import { useT } from "@/lib/i18n/client";

interface CompoundOption { id: string; name: string; }
interface ResidentOption { id: string; full_name: string; }
interface UnitOption     { id: string; unit_number: string; }

interface TicketFormProps {
  compounds: CompoundOption[];
  residents: ResidentOption[];
  units: UnitOption[];
}

type Errors = Partial<Record<keyof TicketInput | "form", string>>;

export function TicketForm({ compounds, residents, units }: TicketFormProps) {
  const router = useRouter();
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Errors>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const candidate = {
      compound_id: String(fd.get("compound_id") ?? ""),
      resident_id: String(fd.get("resident_id") ?? "").replace("__none__", ""),
      unit_id: String(fd.get("unit_id") ?? "").replace("__none__", ""),
      category: String(fd.get("category") ?? "other"),
      subject: String(fd.get("subject") ?? ""),
      description: String(fd.get("description") ?? ""),
      priority: String(fd.get("priority") ?? "medium"),
      sla_due_date: String(fd.get("sla_due_date") ?? ""),
    };
    const parsed = ticketSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Errors = {};
      for (const [k, v] of Object.entries(flat)) next[k as keyof TicketInput] = (v ?? [])[0];
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        const created = await createTicket(parsed.data);
        toast.success(t("forms.toast_ticket_created"), { description: created.ticket_number });
        router.push(`/tickets/${created.id}`);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : t("forms.unknown_error");
        setErrors({ form: msg });
        toast.error(t("forms.toast_save_failed"), { description: msg });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-2">
          <Field label="Compound" error={errors.compound_id}>
            <Select name="compound_id" defaultValue={compounds[0]?.id} required>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {compounds.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Category" error={errors.category}>
            <Select name="category" defaultValue="maintenance">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TICKET_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Resident (optional)" error={errors.resident_id}>
            <Select name="resident_id" defaultValue="__none__">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {residents.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Unit (optional)" error={errors.unit_id}>
            <Select name="unit_id" defaultValue="__none__">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.unit_number}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Priority" error={errors.priority}>
            <Select name="priority" defaultValue="medium">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="SLA due date (optional)" error={errors.sla_due_date}>
            <Input type="date" name="sla_due_date" />
          </Field>

          <Field label="Subject" error={errors.subject} className="md:col-span-2">
            <Input name="subject" required maxLength={160} placeholder="Brief summary" />
          </Field>

          <Field label="Description" error={errors.description} className="md:col-span-2">
            <textarea
              name="description"
              required
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Describe the issue in detail"
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
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Create ticket"}</Button>
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
