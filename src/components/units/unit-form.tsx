"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { unitSchema, type UnitInput } from "@/lib/validations/unit";
import { createUnit, updateUnit } from "@/lib/api/units";
import { useT } from "@/lib/i18n/client";

interface BuildingOption { id: string; name: string; compound_id: string; }
interface FloorOption { id: string; label: string; }

interface UnitFormProps {
  buildings: BuildingOption[];
  floorsByBuilding: Record<string, FloorOption[]>;
  initial?: Partial<UnitInput> & { id?: string };
  defaultBuildingId?: string;
}

type Errors = Partial<Record<keyof UnitInput | "form", string>>;

const UNIT_TYPES = [
  "apartment", "villa", "townhouse", "studio",
  "duplex", "penthouse", "office", "commercial", "other",
] as const;

export function UnitForm({ buildings, floorsByBuilding, initial, defaultBuildingId }: UnitFormProps) {
  const router = useRouter();
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const editing = !!initial?.id;

  const [buildingId, setBuildingId] = useState(initial?.building_id ?? defaultBuildingId ?? buildings[0]?.id ?? "");
  const floors = floorsByBuilding[buildingId] ?? [];

  useEffect(() => {
    // Reset floor when building changes
    if (!floors.find((f) => f.id === initial?.floor_id)) {
      // keep field but UI shows empty
    }
  }, [buildingId, floors, initial?.floor_id]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);

    // Sentinel "__none__" represents "no floor selected" because Radix Select
    // disallows empty string values. Convert to "" so Zod treats it as undefined.
    const rawFloorId = String(fd.get("floor_id") ?? "");
    const candidate = {
      building_id: String(fd.get("building_id") ?? ""),
      floor_id: rawFloorId === "__none__" ? "" : rawFloorId,
      unit_number: String(fd.get("unit_number") ?? ""),
      unit_type: String(fd.get("unit_type") ?? "apartment"),
      status: String(fd.get("status") ?? "vacant"),
      ownership_status: String(fd.get("ownership_status") ?? "owned"),
      floor: String(fd.get("floor") ?? ""),
      area_sqm: String(fd.get("area_sqm") ?? ""),
      bedrooms: String(fd.get("bedrooms") ?? ""),
      bathrooms: String(fd.get("bathrooms") ?? ""),
      parking_slots: String(fd.get("parking_slots") ?? ""),
      purchase_price: String(fd.get("purchase_price") ?? ""),
      rent_price: String(fd.get("rent_price") ?? ""),
      maintenance_fee: String(fd.get("maintenance_fee") ?? ""),
      description: String(fd.get("description") ?? ""),
    };

    const parsed = unitSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Errors = {};
      for (const [k, v] of Object.entries(flat)) {
        next[k as keyof UnitInput] = (v ?? [])[0];
      }
      setErrors(next);
      return;
    }

    startTransition(async () => {
      try {
        if (editing && initial?.id) {
          await updateUnit(initial.id, parsed.data);
          toast.success(t("forms.toast_unit_updated"));
        } else {
          await createUnit(parsed.data);
          toast.success(t("forms.toast_unit_created"));
        }
        router.push("/units");
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
          <Field label={t("forms.building")} error={errors.building_id}>
            <Select name="building_id" value={buildingId} onValueChange={setBuildingId} required>
              <SelectTrigger><SelectValue placeholder={t("forms.select_building")} /></SelectTrigger>
              <SelectContent>
                {buildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("forms.floor")} error={errors.floor_id}>
            <Select name="floor_id" defaultValue={initial?.floor_id ?? "__none__"}>
              <SelectTrigger><SelectValue placeholder={t("forms.optional")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("forms.none")}</SelectItem>
                {floors.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("forms.unit_number")} error={errors.unit_number}>
            <Input name="unit_number" defaultValue={initial?.unit_number} required />
          </Field>
          <Field label={t("forms.floor_display")} error={errors.floor}>
            <Input type="number" name="floor" defaultValue={initial?.floor ?? ""} />
          </Field>

          <Field label={t("forms.unit_type")} error={errors.unit_type}>
            <Select name="unit_type" defaultValue={initial?.unit_type ?? "apartment"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNIT_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("forms.status")} error={errors.status}>
            <Select name="status" defaultValue={initial?.status ?? "vacant"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vacant">{t("forms.unit_status_vacant")}</SelectItem>
                <SelectItem value="occupied">{t("forms.unit_status_occupied")}</SelectItem>
                <SelectItem value="reserved">{t("forms.unit_status_reserved")}</SelectItem>
                <SelectItem value="maintenance">{t("forms.unit_status_maintenance")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("forms.ownership")} error={errors.ownership_status}>
            <Select name="ownership_status" defaultValue={initial?.ownership_status ?? "owned"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owned">{t("forms.ownership_owned")}</SelectItem>
                <SelectItem value="for_sale">{t("forms.ownership_for_sale")}</SelectItem>
                <SelectItem value="for_rent">{t("forms.ownership_for_rent")}</SelectItem>
                <SelectItem value="leased">{t("forms.ownership_leased")}</SelectItem>
                <SelectItem value="reserved">{t("forms.ownership_reserved")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("forms.area_sqm")} error={errors.area_sqm}>
            <Input type="number" step="0.01" name="area_sqm" defaultValue={initial?.area_sqm ?? ""} />
          </Field>

          <Field label={t("forms.bedrooms")} error={errors.bedrooms}>
            <Input type="number" name="bedrooms" defaultValue={initial?.bedrooms ?? ""} />
          </Field>
          <Field label={t("forms.bathrooms")} error={errors.bathrooms}>
            <Input type="number" name="bathrooms" defaultValue={initial?.bathrooms ?? ""} />
          </Field>
          <Field label={t("forms.parking_slots")} error={errors.parking_slots}>
            <Input type="number" name="parking_slots" defaultValue={initial?.parking_slots ?? 0} />
          </Field>

          <Field label={t("forms.purchase_price")} error={errors.purchase_price}>
            <Input type="number" step="0.01" name="purchase_price" defaultValue={initial?.purchase_price ?? ""} />
          </Field>
          <Field label={t("forms.monthly_rent")} error={errors.rent_price}>
            <Input type="number" step="0.01" name="rent_price" defaultValue={initial?.rent_price ?? ""} />
          </Field>
          <Field label={t("forms.maintenance_fee")} error={errors.maintenance_fee}>
            <Input type="number" step="0.01" name="maintenance_fee" defaultValue={initial?.maintenance_fee ?? ""} />
          </Field>

          <Field label={t("forms.description")} error={errors.description} className="md:col-span-2">
            <textarea
              name="description"
              defaultValue={initial?.description ?? ""}
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
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>{t("actions.cancel")}</Button>
        <Button type="submit" disabled={pending}>
          {pending ? t("forms.saving") : editing ? t("forms.save_changes") : t("forms.create_unit")}
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
