"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  pricingRuleSchema, PRICING_METHODS, SERVICE_KINDS,
} from "@/lib/validations/pricing";
import { createPricingRule } from "@/lib/api/pricing";
import { useT } from "@/lib/i18n/client";

interface OrgOption { id: string; name: string; }
interface PricingRuleFormProps { organizations: OrgOption[]; }

function safeJson(s: string): unknown {
  if (!s.trim()) return [];
  try { return JSON.parse(s); } catch { return { __invalid: true }; }
}

export function PricingRuleForm({ organizations }: PricingRuleFormProps) {
  const router = useRouter();
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<string>("flat");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const tiersRaw = String(fd.get("tiers") ?? "[]");
    const scheduleRaw = String(fd.get("schedule") ?? "{}");
    const tiers = safeJson(tiersRaw);
    const schedule = safeJson(scheduleRaw);
    if ((tiers as { __invalid?: boolean }).__invalid) {
      setErrors({ tiers: t("forms.invalid_json") }); return;
    }
    if ((schedule as { __invalid?: boolean }).__invalid) {
      setErrors({ schedule: t("forms.invalid_json") }); return;
    }
    const candidate = {
      organization_id: String(fd.get("organization_id") ?? ""),
      compound_id: "",
      name: String(fd.get("name") ?? ""),
      service_kind: String(fd.get("service_kind") ?? "electricity"),
      method: String(fd.get("method") ?? "flat"),
      base_amount: Number(fd.get("base_amount") ?? 0),
      unit_amount: Number(fd.get("unit_amount") ?? 0),
      min_amount: String(fd.get("min_amount") ?? ""),
      max_amount: String(fd.get("max_amount") ?? ""),
      currency: String(fd.get("currency") ?? "USD"),
      tiers: Array.isArray(tiers) ? tiers : [],
      formula: String(fd.get("formula") ?? ""),
      schedule: typeof schedule === "object" && schedule ? schedule as Record<string, unknown> : {},
      is_active: true,
      effective_from: String(fd.get("effective_from") ?? new Date().toISOString().slice(0, 10)),
      effective_to: String(fd.get("effective_to") ?? ""),
      priority: Number(fd.get("priority") ?? 100),
      notes: String(fd.get("notes") ?? ""),
    };
    const parsed = pricingRuleSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) next[k] = (v ?? [])[0]!;
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        await createPricingRule(parsed.data);
        toast.success(t("forms.toast_pricing_rule_created"));
        router.push("/pricing-rules");
        router.refresh();
      } catch (err) {
        toast.error(t("forms.toast_save_failed"), { description: err instanceof Error ? err.message : "" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-2">
          <div className="md:col-span-2 space-y-2">
            <Label>{t("forms.organization")}</Label>
            <Select name="organization_id" defaultValue={organizations[0]?.id} required>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {organizations.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("forms.name")}</Label>
            <Input name="name" required placeholder={t("forms.pricing_rule_name_placeholder")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label>{t("forms.service_kind")}</Label>
            <Select name="service_kind" defaultValue="electricity">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICE_KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("forms.method")}</Label>
            <Select name="method" defaultValue="flat" value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRICING_METHODS.map((m) => <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("forms.currency")}</Label>
            <Select name="currency" defaultValue="USD">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="IQD">IQD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="AED">AED</SelectItem>
                <SelectItem value="SAR">SAR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("forms.base_amount")}</Label>
            <Input name="base_amount" type="number" step="0.0001" defaultValue={0} />
          </div>
          <div className="space-y-2">
            <Label>{t("forms.unit_rate")}</Label>
            <Input name="unit_amount" type="number" step="0.0001" defaultValue={0} />
            <p className="text-[11px] text-muted-foreground">
              {t("forms.unit_rate_note")}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t("forms.min_amount_optional")}</Label>
            <Input name="min_amount" type="number" step="0.01" />
          </div>
          <div className="space-y-2">
            <Label>{t("forms.max_amount_optional")}</Label>
            <Input name="max_amount" type="number" step="0.01" />
          </div>

          <div className="space-y-2">
            <Label>{t("forms.effective_from")}</Label>
            <Input name="effective_from" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="space-y-2">
            <Label>{t("forms.effective_to_optional")}</Label>
            <Input name="effective_to" type="date" />
          </div>

          <div className="space-y-2">
            <Label>{t("forms.priority")}</Label>
            <Input name="priority" type="number" defaultValue={100} />
            <p className="text-[11px] text-muted-foreground">{t("forms.priority_note")}</p>
          </div>
          <div className="space-y-2">
            <Label>{t("forms.notes")}</Label>
            <Input name="notes" />
          </div>

          {(method === "tiered" || method === "time_of_use" || method === "seasonal") && (
            <div className="md:col-span-2 space-y-2">
              <Label>{t("forms.tiers_json")}</Label>
              <Textarea name="tiers" rows={3} placeholder={t("forms.pricing_tiers_placeholder")} />
              {errors.tiers && <p className="text-xs text-destructive">{errors.tiers}</p>}
            </div>
          )}

          {(method === "time_of_use" || method === "seasonal") && (
            <div className="md:col-span-2 space-y-2">
              <Label>{t("forms.schedule_json")}</Label>
              <Textarea name="schedule" rows={3} placeholder={t("forms.pricing_schedule_placeholder")} />
              {errors.schedule && <p className="text-xs text-destructive">{errors.schedule}</p>}
            </div>
          )}

          {method === "formula" && (
            <div className="md:col-span-2 space-y-2">
              <Label>{t("forms.formula")}</Label>
              <Input name="formula" placeholder={t("forms.pricing_formula_placeholder")} />
              <p className="text-[11px] text-muted-foreground">
                {t("forms.formula_tokens_note", { tokens: t("forms.pricing_formula_tokens") })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>{t("actions.cancel")}</Button>
        <Button type="submit" disabled={pending}>{pending ? t("forms.saving") : t("forms.create_rule")}</Button>
      </div>
    </form>
  );
}
