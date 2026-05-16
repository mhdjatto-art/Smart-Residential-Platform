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
import { internetPackageSchema } from "@/lib/validations/utilities";
import { createInternetPackage } from "@/lib/api/utilities";
import { useT } from "@/lib/i18n/client";

interface ProviderOption { id: string; name: string; }
interface InternetPackageFormProps { providers: ProviderOption[]; }

export function InternetPackageForm({ providers }: InternetPackageFormProps) {
  const router = useRouter();
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const dataCap = String(fd.get("data_cap_gb") ?? "");
    const speedUp = String(fd.get("speed_mbps_up") ?? "");
    const candidate = {
      provider_id: String(fd.get("provider_id") ?? ""),
      package_name: String(fd.get("package_name") ?? ""),
      package_tier: String(fd.get("package_tier") ?? "standard"),
      speed_mbps_down: Number(fd.get("speed_mbps_down") ?? 0),
      speed_mbps_up: speedUp ? Number(speedUp) : undefined,
      data_cap_gb: dataCap ? Number(dataCap) : undefined,
      monthly_price: Number(fd.get("monthly_price") ?? 0),
      currency: String(fd.get("currency") ?? "IQD"),
      suspension_policy: String(fd.get("suspension_policy") ?? "after_grace"),
      is_active: true,
      description: String(fd.get("description") ?? ""),
    };
    const parsed = internetPackageSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) next[k] = (v ?? [])[0]!;
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        await createInternetPackage(parsed.data);
        toast.success(t("forms.toast_package_created"));
        router.push("/internet-packages");
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
            <Label>{t("forms.provider")}</Label>
            <Select name="provider_id" defaultValue={providers[0]?.id} required>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("forms.package_name")}</Label>
            <Input name="package_name" required placeholder={t("forms.package_name_placeholder")} />
            {errors.package_name && <p className="text-xs text-destructive">{errors.package_name}</p>}
          </div>
          <div className="space-y-2">
            <Label>{t("forms.tier")}</Label>
            <Select name="package_tier" defaultValue="standard">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">{t("forms.tier_basic")}</SelectItem>
                <SelectItem value="standard">{t("forms.tier_standard")}</SelectItem>
                <SelectItem value="premium">{t("forms.tier_premium")}</SelectItem>
                <SelectItem value="enterprise">{t("forms.tier_enterprise")}</SelectItem>
                <SelectItem value="custom">{t("forms.tier_custom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("forms.download_speed")}</Label>
            <Input name="speed_mbps_down" type="number" required />
            {errors.speed_mbps_down && <p className="text-xs text-destructive">{errors.speed_mbps_down}</p>}
          </div>
          <div className="space-y-2">
            <Label>{t("forms.upload_speed")}</Label>
            <Input name="speed_mbps_up" type="number" placeholder={t("forms.optional")} />
          </div>

          <div className="space-y-2">
            <Label>{t("forms.data_cap")}</Label>
            <Input name="data_cap_gb" type="number" placeholder={t("forms.data_cap_placeholder")} />
          </div>
          <div className="space-y-2">
            <Label>{t("forms.monthly_price")}</Label>
            <Input name="monthly_price" type="number" step="0.01" required />
            {errors.monthly_price && <p className="text-xs text-destructive">{errors.monthly_price}</p>}
          </div>

          <div className="space-y-2">
            <Label>{t("forms.currency")}</Label>
            <Select name="currency" defaultValue="IQD">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="IQD">IQD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="SAR">SAR</SelectItem>
                <SelectItem value="AED">AED</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("forms.suspension_policy")}</Label>
            <Select name="suspension_policy" defaultValue="after_grace">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">{t("forms.suspension_immediate")}</SelectItem>
                <SelectItem value="after_grace">{t("forms.suspension_after_grace")}</SelectItem>
                <SelectItem value="manual">{t("forms.suspension_manual")}</SelectItem>
                <SelectItem value="never">{t("forms.suspension_never")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>{t("forms.description")}</Label>
            <Textarea name="description" rows={3} placeholder={t("forms.description_optional")} />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>{t("actions.cancel")}</Button>
        <Button type="submit" disabled={pending}>{pending ? t("forms.saving") : t("forms.create_package")}</Button>
      </div>
    </form>
  );
}
