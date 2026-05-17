"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildingSchema, type BuildingInput } from "@/lib/validations/building";
import { createBuilding, updateBuilding } from "@/lib/api/buildings";
import { useT } from "@/lib/i18n/client";

interface CompoundOption { id: string; name: string; }

interface BuildingFormProps {
  compounds: CompoundOption[];
  initial?: Partial<BuildingInput> & { id?: string };
  defaultCompoundId?: string;
}

type Errors = Partial<Record<keyof BuildingInput | "form", string>>;

export function BuildingForm({ compounds, initial, defaultCompoundId }: BuildingFormProps) {
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
      name: String(fd.get("name") ?? ""),
      code: String(fd.get("code") ?? ""),
      number_of_floors: String(fd.get("number_of_floors") ?? ""),
      description: String(fd.get("description") ?? ""),
      status: String(fd.get("status") ?? "active"),
    };

    const parsed = buildingSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Errors = {};
      for (const [k, v] of Object.entries(flat)) {
        next[k as keyof BuildingInput] = (v ?? [])[0];
      }
      setErrors(next);
      return;
    }

    startTransition(async () => {
      try {
        if (editing && initial?.id) {
          await updateBuilding(initial.id, parsed.data);
          toast.success(t("forms.toast_building_updated"));
        } else {
          await createBuilding(parsed.data);
          toast.success(t("forms.toast_building_created"));
        }
        router.push("/buildings");
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
          <Field label="Compound" error={errors.compound_id} className="md:col-span-2">
            <Select name="compound_id" defaultValue={initial?.compound_id ?? defaultCompoundId} required>
              <SelectTrigger><SelectValue placeholder="Select compound" /></SelectTrigger>
              <SelectContent>
                {compounds.length === 0 && <SelectItem value="__empty__" disabled>No compounds</SelectItem>}
                {compounds.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Name" error={errors.name}>
            <Input name="name" defaultValue={initial?.name} required />
          </Field>
          <Field label="Code" error={errors.code}>
            <Input name="code" defaultValue={initial?.code ?? ""} placeholder="e.g. TA" />
          </Field>

          <Field label="Number of floors" error={errors.number_of_floors}>
            <Input type="number" name="number_of_floors" defaultValue={initial?.number_of_floors ?? ""} min={0} />
          </Field>
          <Field label="Status" error={errors.status}>
            <Select name="status" defaultValue={initial?.status ?? "active"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="under_construction">Under construction</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Description" error={errors.description} className="md:col-span-2">
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
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Create building"}
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
