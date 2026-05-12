"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ticketSchema, TICKET_CATEGORIES } from "@/lib/validations/operations";
import { createTicket } from "@/lib/api/tickets";
import { useT } from "@/lib/i18n/client";

interface NewComplaintFormProps {
  compoundId: string;
  residentId: string;
  unitId: string | null;
}

export function NewComplaintForm({ compoundId, residentId, unitId }: NewComplaintFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { t } = useT();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const candidate = {
      compound_id: compoundId,
      resident_id: residentId,
      unit_id: unitId ?? "",
      category: String(fd.get("category") ?? "maintenance"),
      subject: String(fd.get("subject") ?? ""),
      description: String(fd.get("description") ?? ""),
      priority: String(fd.get("priority") ?? "medium"),
      sla_due_date: "",
    };
    const parsed = ticketSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) next[k] = (v ?? [])[0]!;
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        const t = await createTicket(parsed.data);
        toast.success("Complaint submitted");
        router.push(`/m/complaints/${t.id}`);
        router.refresh();
      } catch (err) {
        toast.error("Submit failed", { description: err instanceof Error ? err.message : "" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardContent className="grid gap-4 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("mobile.category")}</Label>
            <Select name="category" defaultValue="maintenance">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TICKET_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("mobile.subject")}</Label>
            <Input name="subject" required />
            {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("mobile.describe_problem")}</Label>
            <Textarea name="description" rows={5} required />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("mobile.priority")}</Label>
            <Select name="priority" defaultValue="medium">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t("mobile.low")}</SelectItem>
                <SelectItem value="medium">{t("mobile.medium")}</SelectItem>
                <SelectItem value="high">{t("mobile.high")}</SelectItem>
                <SelectItem value="urgent">{t("mobile.urgent")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <Button type="submit" className="mt-4 w-full" disabled={pending}>{pending ? t("mobile.submitting") : t("mobile.submit_complaint")}</Button>
    </form>
  );
}
