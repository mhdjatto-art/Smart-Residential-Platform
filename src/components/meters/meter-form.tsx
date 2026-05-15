"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { meterSchema, type MeterInput } from "@/lib/validations/utilities";
import { createMeter } from "@/lib/api/utilities";
import { useT } from "@/lib/i18n/client";

interface CompoundOption { id: string; name: string; }
interface UnitOption { id: string; unit_number: string; }

interface MeterFormProps {
  compounds: CompoundOption[];
  units: UnitOption[];
}

export function MeterForm({ compounds, units }: MeterFormProps) {
  const router = useRouter();
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const candidate = {
      compound_id: String(fd.get("compound_id") ?? ""),
      unit_id: String(fd.get("unit_id") ?? "").replace("__none__", ""),
      meter_number: String(fd.get("meter_number") ?? ""),
      brand: String(fd.get("brand") ?? ""),
      model: String(fd.get("model") ?? ""),
      serial_number: String(fd.get("serial_number") ?? ""),
      installed_at: String(fd.get("installed_at") ?? ""),
      current_reading: String(fd.get("current_reading") ?? "0"),
      unit_of_measure: String(fd.get("unit_of_measure") ?? "kWh"),
      smart_enabled: fd.get("smart_enabled") === "on",
      notes: String(fd.get("notes") ?? ""),
    };
    const parsed = meterSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) next[k] = (v ?? [])[0]!;
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        await createMeter(parsed.data);
        toast.success(t("forms.toast_meter_registered"));
        router.push("/meters");
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
          <div className="space-y-2">
            <Label>{t("forms.compound")}</Label>
            <Select name="compound_id" defaultValue={compounds[0]?.id} required>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {compounds.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("forms.unit_optional")}</Label>
            <Select name="unit_id" defaultValue="__none__">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("forms.none")}</SelectItem>
                {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.unit_number}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("forms.meter_number")}</Label>
            <Input name="meter_number" required />
            {errors.meter_number && <p className="text-xs text-destructive">{errors.meter_number}</p>}
          </div>
          <div className="space-y-2">
            <Label>{t("forms.unit_of_measure")}</Label>
            <Input name="unit_of_measure" defaultValue="kWh" />
          </div>

          <div className="space-y-2">
            <Label>{t("forms.brand")}</Label>
            <Input name="brand" />
          </div>
          <div className="space-y-2">
            <Label>{t("forms.model")}</Label>
            <Input name="model" />
          </div>

          <div className="space-y-2">
            <Label>{t("forms.serial_number")}</Label>
            <Input name="serial_number" />
          </div>
          <div className="space-y-2">
            <Label>{t("forms.installed_at")}</Label>
            <Input type="date" name="installed_at" />
          </div>

          <div className="space-y-2">
            <Label>{t("forms.current_reading")}</Label>
            <Input type="number" step="0.01" name="current_reading" defaultValue="0" />
          </div>
          <label className="flex items-center gap-2 text-sm pt-7">
            <input type="checkbox" name="smart_enabled" />
            {t("forms.smart_meter_label")}
          </label>

          <div className="md:col-span-2 space-y-2">
            <Label>{t("forms.notes")}</Label>
            <textarea name="notes" rows={2} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>{t("actions.cancel")}</Button>
        <Button type="submit" disabled={pending}>{pending ? t("forms.saving") : t("forms.add_meter")}</Button>
      </div>
    </form>
  );
}
