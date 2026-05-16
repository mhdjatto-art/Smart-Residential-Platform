"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createPlan, updatePlan, deletePlan, type PlanInput, type SubscriptionPlanRow } from "@/lib/api/saas";
import { useT } from "@/lib/i18n/client";

interface PlanFormProps {
  initial?: SubscriptionPlanRow;
  mode: "create" | "edit";
}

const TIERS = ["starter", "professional", "enterprise", "custom"] as const;

export function PlanForm({ initial, mode }: PlanFormProps) {
  const router = useRouter();
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();

  const [form, setForm] = useState<PlanInput>({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    tier: (initial?.tier as PlanInput["tier"]) ?? "starter",
    description: initial?.description ?? "",
    monthly_price: initial?.monthly_price ?? 0,
    annual_price: initial?.annual_price ?? 0,
    currency: initial?.currency ?? "IQD",
    max_compounds: initial?.max_compounds ?? null,
    max_units: initial?.max_units ?? null,
    max_residents: initial?.max_residents ?? null,
    max_admin_users: initial?.max_admin_users ?? null,
    max_storage_mb: initial?.max_storage_mb ?? null,
    max_api_calls_per_month: initial?.max_api_calls_per_month ?? null,
    is_active: initial?.is_active ?? true,
    display_order: initial?.display_order ?? 0,
  });

  function set<K extends keyof PlanInput>(key: K, value: PlanInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function numOrNull(s: string): number | null {
    if (s.trim() === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast.error(t("forms.toast_code_name_required"));
      return;
    }
    startTransition(async () => {
      try {
        if (mode === "create") {
          const id = await createPlan(form);
          toast.success(t("forms.toast_plan_created"));
          router.push(`/saas-console/plans/${id}/edit`);
        } else if (initial) {
          await updatePlan(initial.id, form);
          toast.success(t("forms.toast_plan_updated"));
          router.refresh();
        }
      } catch (err) {
        toast.error(t("forms.toast_save_failed"), { description: err instanceof Error ? err.message : t("forms.unknown_error") });
      }
    });
  }

  function onDelete() {
    if (!initial) return;
    if (!confirm(t("forms.confirm_delete_plan", { name: initial.name }))) return;
    startDelete(async () => {
      try {
        await deletePlan(initial.id);
        toast.success(t("forms.toast_plan_deleted"));
        router.push("/saas-console/plans");
        router.refresh();
      } catch (err) {
        toast.error(t("forms.toast_delete_failed"), { description: err instanceof Error ? err.message : t("forms.unknown_error") });
      }
    });
  }

  const quotaLabels: Array<[keyof PlanInput, string]> = [
    ["max_compounds", t("forms.compounds_quota")],
    ["max_units", t("forms.units_quota")],
    ["max_residents", t("forms.residents_quota")],
    ["max_admin_users", t("forms.admin_users_quota")],
    ["max_storage_mb", t("forms.storage_quota")],
    ["max_api_calls_per_month", t("forms.api_calls_quota")],
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("forms.basic_info_title")}</CardTitle>
          <CardDescription>{t("forms.basic_info_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="code">{t("forms.code")}</Label>
            <Input id="code" value={form.code} onChange={(e) => set("code", e.target.value.toLowerCase())}
              placeholder={t("forms.code_placeholder_starter")} pattern="[a-z0-9_-]{2,32}" required />
            <p className="text-[11px] text-muted-foreground">{t("forms.code_format_note")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">{t("forms.display_name")}</Label>
            <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder={t("forms.name_placeholder_starter")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tier">{t("forms.tier")}</Label>
            <select id="tier" value={form.tier} onChange={(e) => set("tier", e.target.value as PlanInput["tier"])}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {TIERS.map((tv) => <option key={tv} value={tv}>{tv}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="display_order">{t("forms.display_order")}</Label>
            <Input id="display_order" type="number" value={form.display_order}
              onChange={(e) => set("display_order", Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">{t("forms.description")}</Label>
            <Textarea id="description" rows={3} value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder={t("forms.description_plan_placeholder")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("forms.pricing_card_title")}</CardTitle>
          <CardDescription>{t("forms.pricing_card_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="monthly_price">{t("forms.monthly_price")}</Label>
            <Input id="monthly_price" type="number" min={0} step="0.01" value={form.monthly_price}
              onChange={(e) => set("monthly_price", Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="annual_price">{t("forms.annual_price")}</Label>
            <Input id="annual_price" type="number" min={0} step="0.01" value={form.annual_price}
              onChange={(e) => set("annual_price", Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">{t("forms.currency")}</Label>
            <Input id="currency" value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())}
              maxLength={3} placeholder="USD" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("forms.quotas_title")}</CardTitle>
          <CardDescription>{t("forms.quotas_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quotaLabels.map(([key, label]) => (
            <div key={key as string} className="space-y-2">
              <Label htmlFor={key as string}>{label}</Label>
              <Input id={key as string} type="number" min={0}
                value={form[key] === null || form[key] === undefined ? "" : String(form[key])}
                onChange={(e) => set(key, numOrNull(e.target.value) as never)}
                placeholder={t("forms.unlimited")} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("forms.visibility_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)} />
            {t("forms.plan_active_label")}
          </label>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || deleting}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {mode === "create" ? t("forms.create_plan") : t("forms.save_changes")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending || deleting}>
            {t("actions.cancel")}
          </Button>
        </div>
        {mode === "edit" && (
          <Button type="button" variant="destructive" onClick={onDelete} disabled={pending || deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {t("forms.delete_plan")}
          </Button>
        )}
      </div>
    </form>
  );
}
