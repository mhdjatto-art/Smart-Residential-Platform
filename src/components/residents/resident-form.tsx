"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { residentSchema, type ResidentInput } from "@/lib/validations/resident";
import { createResident, updateResident } from "@/lib/api/residents";
import { useT } from "@/lib/i18n/client";

interface CompoundOption { id: string; name: string; }

interface ResidentFormProps {
  compounds: CompoundOption[];
  initial?: Partial<ResidentInput> & { id?: string };
  defaultCompoundId?: string;
}

type Errors = Partial<Record<keyof ResidentInput | "form", string>>;

export function ResidentForm({ compounds, initial, defaultCompoundId }: ResidentFormProps) {
  const router = useRouter();
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const editing = !!initial?.id;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);

    const candidate = {
      compound_id: String(fd.get("compound_id") ?? ""),
      first_name: String(fd.get("first_name") ?? ""),
      last_name: String(fd.get("last_name") ?? ""),
      email: String(fd.get("email") ?? ""),
      mobile: String(fd.get("mobile") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      national_id: String(fd.get("national_id") ?? ""),
      gender: String(fd.get("gender") ?? "unspecified"),
      date_of_birth: String(fd.get("date_of_birth") ?? ""),
      occupation: String(fd.get("occupation") ?? ""),
      tenancy_type: String(fd.get("tenancy_type") ?? "tenant"),
      status: String(fd.get("status") ?? "active"),
    };

    const parsed = residentSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Errors = {};
      for (const [k, v] of Object.entries(flat)) {
        next[k as keyof ResidentInput] = (v ?? [])[0];
      }
      setErrors(next);
      return;
    }

    startTransition(async () => {
      try {
        if (editing && initial?.id) {
          await updateResident(initial.id, parsed.data);
          toast.success(t("forms.toast_resident_updated"));
          router.push(`/residents/${initial.id}`);
        } else {
          const created = await createResident(parsed.data);
          toast.success(t("forms.toast_resident_created"));
          router.push(`/residents/${created.id}`);
        }
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
          <Field label={t("forms.compound")} error={errors.compound_id} className="md:col-span-2">
            <Select name="compound_id" defaultValue={initial?.compound_id ?? defaultCompoundId} required>
              <SelectTrigger><SelectValue placeholder={t("forms.select_compound")} /></SelectTrigger>
              <SelectContent>
                {compounds.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("forms.first_name")} error={errors.first_name}>
            <Input name="first_name" defaultValue={initial?.first_name} required />
          </Field>
          <Field label={t("forms.last_name")} error={errors.last_name}>
            <Input name="last_name" defaultValue={initial?.last_name} required />
          </Field>

          <Field label={t("forms.email")} error={errors.email}>
            <Input type="email" name="email" defaultValue={initial?.email ?? ""} />
          </Field>
          <Field label={t("forms.mobile")} error={errors.mobile}>
            <Input name="mobile" defaultValue={initial?.mobile ?? ""} placeholder="+971…" />
          </Field>

          <Field label={t("forms.national_id")} error={errors.national_id}>
            <Input name="national_id" defaultValue={initial?.national_id ?? ""} />
          </Field>
          <Field label={t("forms.gender")} error={errors.gender}>
            <Select name="gender" defaultValue={initial?.gender ?? "unspecified"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{t("forms.gender_male")}</SelectItem>
                <SelectItem value="female">{t("forms.gender_female")}</SelectItem>
                <SelectItem value="unspecified">{t("forms.gender_unspecified")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("forms.date_of_birth")} error={errors.date_of_birth}>
            <Input type="date" name="date_of_birth" defaultValue={initial?.date_of_birth ?? ""} />
          </Field>
          <Field label={t("forms.occupation")} error={errors.occupation}>
            <Input name="occupation" defaultValue={initial?.occupation ?? ""} />
          </Field>

          <Field label={t("forms.tenancy_type")} error={errors.tenancy_type}>
            <Select name="tenancy_type" defaultValue={initial?.tenancy_type ?? "tenant"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">{t("forms.owner")}</SelectItem>
                <SelectItem value="tenant">{t("forms.tenant")}</SelectItem>
                <SelectItem value="family_member">{t("forms.family_member")}</SelectItem>
                <SelectItem value="guest">{t("forms.guest")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("forms.status")} error={errors.status}>
            <Select name="status" defaultValue={initial?.status ?? "active"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("forms.status_active")}</SelectItem>
                <SelectItem value="pending">{t("forms.status_pending")}</SelectItem>
                <SelectItem value="former">{t("forms.status_former")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      {errors.form && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errors.form}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>{t("actions.cancel")}</Button>
        <Button type="submit" disabled={pending}>
          {pending ? t("forms.saving") : editing ? t("forms.save_changes") : t("forms.create_resident")}
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
