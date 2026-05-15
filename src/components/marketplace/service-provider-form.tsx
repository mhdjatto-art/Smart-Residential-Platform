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
  serviceProviderSchema, PROVIDER_KINDS, PROVIDER_VERIFICATION_STATUSES,
  PROVIDER_AVAILABILITY_STATUSES, COMMISSION_KINDS,
} from "@/lib/validations/marketplace";
import { createServiceProvider } from "@/lib/api/marketplace";
import { useT } from "@/lib/i18n/client";

interface OrgOption { id: string; name: string; }
interface ServiceProviderFormProps { organizations: OrgOption[]; }

export function ServiceProviderForm({ organizations }: ServiceProviderFormProps) {
  const router = useRouter();
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const candidate = {
      organization_id: String(fd.get("organization_id") ?? ""),
      compound_id: "",
      provider_name: String(fd.get("provider_name") ?? ""),
      provider_kind: String(fd.get("provider_kind") ?? "other"),
      slug: "",
      description: String(fd.get("description") ?? ""),
      mobile: String(fd.get("mobile") ?? ""),
      email: String(fd.get("email") ?? ""),
      website: String(fd.get("website") ?? ""),
      address: String(fd.get("address") ?? ""),
      verification_status: String(fd.get("verification_status") ?? "unverified"),
      availability_status: String(fd.get("availability_status") ?? "open"),
      is_active: true,
      default_commission_kind: String(fd.get("default_commission_kind") ?? "percentage"),
      default_commission_value: Number(fd.get("default_commission_value") ?? 10),
    };
    const parsed = serviceProviderSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) next[k] = (v ?? [])[0]!;
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        await createServiceProvider(parsed.data);
        toast.success(t("forms.toast_provider_added"));
        router.push("/service-providers");
        router.refresh();
      } catch (err) {
        toast.error(t("forms.toast_save_failed"), { description: err instanceof Error ? err.message : "" });
        setErrors({ form: err instanceof Error ? err.message : t("forms.unknown") });
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
            <Label>{t("forms.provider_name")}</Label>
            <Input name="provider_name" required placeholder={t("forms.provider_name_placeholder_service")} />
            {errors.provider_name && <p className="text-xs text-destructive">{errors.provider_name}</p>}
          </div>
          <div className="space-y-2">
            <Label>{t("forms.kind")}</Label>
            <Select name="provider_kind" defaultValue="other">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDER_KINDS.map((k) => <SelectItem key={k} value={k}>{k.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>{t("forms.description")}</Label>
            <Textarea name="description" rows={3} placeholder={t("forms.description_placeholder_service")} />
          </div>

          <div className="space-y-2">
            <Label>{t("forms.mobile")}</Label>
            <Input name="mobile" />
          </div>
          <div className="space-y-2">
            <Label>{t("forms.email")}</Label>
            <Input type="email" name="email" />
          </div>
          <div className="space-y-2">
            <Label>{t("forms.website")}</Label>
            <Input name="website" />
          </div>
          <div className="space-y-2">
            <Label>{t("forms.address")}</Label>
            <Input name="address" />
          </div>

          <div className="space-y-2">
            <Label>{t("forms.verification_status")}</Label>
            <Select name="verification_status" defaultValue="unverified">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDER_VERIFICATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("forms.availability")}</Label>
            <Select name="availability_status" defaultValue="open">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDER_AVAILABILITY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("forms.commission_kind")}</Label>
            <Select name="default_commission_kind" defaultValue="percentage">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMMISSION_KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("forms.commission_value")}</Label>
            <Input name="default_commission_value" type="number" step="0.01" defaultValue={10} />
            <p className="text-[11px] text-muted-foreground">
              {t("forms.commission_value_note")}
            </p>
          </div>
        </CardContent>
      </Card>

      {errors.form && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errors.form}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>{t("actions.cancel")}</Button>
        <Button type="submit" disabled={pending}>{pending ? t("forms.saving") : t("forms.add_provider")}</Button>
      </div>
    </form>
  );
}
