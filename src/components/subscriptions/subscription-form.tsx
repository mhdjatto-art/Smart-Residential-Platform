"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createSubscription, type ProviderRow } from "@/lib/api/utilities";
import type { UnitOption } from "@/lib/api/units";
import type { SubscriptionInput } from "@/lib/validations/utilities";
import { useT } from "@/lib/i18n/client";

interface SubscriptionFormProps {
  units: UnitOption[];
  providers: ProviderRow[];
  residents: Array<{ id: string; full_name: string }>;
}

const UTILITY_TYPES = ["electricity", "internet", "water", "gas", "maintenance", "generator", "other"] as const;
const CYCLES = ["monthly", "quarterly", "biannual", "annual", "one_time"] as const;

function flag(code?: string | null): string {
  if (!code || code.length !== 2) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + code.toUpperCase().charCodeAt(0) - 65, A + code.toUpperCase().charCodeAt(1) - 65);
}

export function SubscriptionForm({ units, providers, residents }: SubscriptionFormProps) {
  const router = useRouter();
  const { t } = useT();
  const today = new Date().toISOString().slice(0, 10);
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState<SubscriptionInput>({
    unit_id: "",
    resident_id: undefined,
    provider_id: "",
    subscription_type: "electricity",
    billing_cycle: "monthly",
    monthly_fee: 0,
    currency: "IQD",
    internet_package_id: undefined,
    start_date: today,
    end_date: undefined,
    auto_suspend: true,
    notes: undefined,
  });

  // Auto-filter providers by selected subscription_type
  const filteredProviders = useMemo(
    () => providers.filter((p) => p.provider_type === form.subscription_type),
    [providers, form.subscription_type],
  );

  function set<K extends keyof SubscriptionInput>(key: K, value: SubscriptionInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.unit_id || !form.provider_id) {
      toast.error(t("forms.toast_unit_provider_required"));
      return;
    }
    startTransition(async () => {
      try {
        await createSubscription(form);
        toast.success(t("forms.toast_subscription_created"));
        router.push("/subscriptions");
        router.refresh();
      } catch (err) {
        toast.error(t("forms.toast_save_failed"), { description: err instanceof Error ? err.message : t("forms.unknown_error") });
      }
    });
  }

  const selectedProvider = providers.find((p) => p.id === form.provider_id);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("forms.service_card_title")}</CardTitle>
          <CardDescription>{t("forms.service_card_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="subscription_type">{t("forms.service_type")}</Label>
            <select
              id="subscription_type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.subscription_type}
              onChange={(e) => {
                set("subscription_type", e.target.value as SubscriptionInput["subscription_type"]);
                set("provider_id", ""); // reset provider when type changes
              }}
            >
              {UTILITY_TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider_id">{t("forms.provider")}</Label>
            <select
              id="provider_id"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.provider_id}
              onChange={(e) => set("provider_id", e.target.value)}
              required
            >
              <option value="">{t("forms.select_provider")}</option>
              {filteredProviders.map((p) => {
                const country = (p.metadata as Record<string, unknown> | null)?.country as string | undefined;
                return (
                  <option key={p.id} value={p.id}>
                    {flag(country)} {p.provider_name}
                    {p.adapter_kind ? ` · ${p.adapter_kind}` : ""}
                  </option>
                );
              })}
            </select>
            {filteredProviders.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t("forms.no_providers_of_type")} <code>{form.subscription_type}</code>{t("forms.no_providers_seed_hint")}
              </p>
            )}
            {selectedProvider && (
              <p className="text-[11px] text-muted-foreground">
                {t("forms.billing_label_inline", { method: selectedProvider.billing_method.replace("_", " "), tariff: selectedProvider.tariff_type })}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="billing_cycle">{t("forms.billing_cycle")}</Label>
            <select
              id="billing_cycle"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.billing_cycle}
              onChange={(e) => set("billing_cycle", e.target.value as SubscriptionInput["billing_cycle"])}
            >
              {CYCLES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthly_fee">{t("forms.fee_per_cycle")}</Label>
            <div className="flex gap-2">
              <Input id="monthly_fee" type="number" min={0} step="0.01"
                value={form.monthly_fee}
                onChange={(e) => set("monthly_fee", Number(e.target.value) || 0)} />
              <Input
                value={form.currency}
                onChange={(e) => set("currency", e.target.value.toUpperCase())}
                maxLength={3}
                className="w-20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("forms.assignment_card_title")}</CardTitle>
          <CardDescription>{t("forms.assignment_card_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="unit_id">{t("forms.unit")}</Label>
            <select
              id="unit_id"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.unit_id}
              onChange={(e) => set("unit_id", e.target.value)}
              required
            >
              <option value="">{t("forms.select_unit")}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.building_name ? `${u.building_name} · ` : ""}{u.unit_number}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resident_id">{t("forms.resident_optional")}</Label>
            <select
              id="resident_id"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.resident_id ?? ""}
              onChange={(e) => set("resident_id", e.target.value || undefined)}
            >
              <option value="">{t("forms.none_unit_level")}</option>
              {residents.map((r) => (
                <option key={r.id} value={r.id}>{r.full_name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start_date">{t("forms.start_date")}</Label>
            <Input id="start_date" type="date" value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end_date">{t("forms.end_date_optional")}</Label>
            <Input id="end_date" type="date" value={form.end_date ?? ""}
              onChange={(e) => set("end_date", e.target.value || undefined)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("forms.policy_card_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox"
              checked={form.auto_suspend}
              onChange={(e) => set("auto_suspend", e.target.checked)} />
            {t("forms.auto_suspend_label")}
          </label>
          <div className="space-y-2">
            <Label htmlFor="notes">{t("forms.notes")}</Label>
            <Textarea id="notes" rows={3} value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value || undefined)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {pending ? t("forms.creating") : t("forms.create_subscription")}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          {t("actions.cancel")}
        </Button>
      </div>
    </form>
  );
}
