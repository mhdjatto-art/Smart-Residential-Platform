"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { residentSchema, type ResidentInput } from "@/lib/validations/resident";
import { createResident, updateResident } from "@/lib/api/residents";

type FieldErrors = Partial<Record<keyof ResidentInput, string>>;

interface UnitOption {
  id: string;
  unit_number: string;
  building_name: string;
}

interface ResidentFormProps {
  units: UnitOption[];
  initial?: Partial<ResidentInput> & { id?: string };
}

export function ResidentForm({ units, initial }: ResidentFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});

  const isEditing = !!initial?.id;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const candidate = {
      unit_id: String(formData.get("unit_id") ?? ""),
      first_name: String(formData.get("first_name") ?? ""),
      last_name: String(formData.get("last_name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      tenancy_type: String(formData.get("tenancy_type") ?? "tenant"),
      status: String(formData.get("status") ?? "active"),
      move_in_date: String(formData.get("move_in_date") ?? ""),
      move_out_date: String(formData.get("move_out_date") ?? ""),
    };

    const parsed = residentSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: FieldErrors = {};
      for (const [k, v] of Object.entries(flat)) {
        next[k as keyof ResidentInput] = (v ?? [])[0];
      }
      setErrors(next);
      return;
    }

    startTransition(async () => {
      try {
        if (isEditing && initial?.id) {
          await updateResident(initial.id, parsed.data);
          toast.success("Resident updated");
        } else {
          await createResident(parsed.data);
          toast.success("Resident added");
        }
        router.push("/residents");
        router.refresh();
      } catch (err) {
        toast.error("Save failed", { description: err instanceof Error ? err.message : "Unknown error" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-2">
          <Field label="Unit" error={errors.unit_id}>
            <Select name="unit_id" defaultValue={initial?.unit_id} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a unit" />
              </SelectTrigger>
              <SelectContent>
                {units.length === 0 && (
                  <SelectItem value="__empty__" disabled>
                    No units available
                  </SelectItem>
                )}
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.building_name} · {u.unit_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Tenancy" error={errors.tenancy_type}>
            <Select name="tenancy_type" defaultValue={initial?.tenancy_type ?? "tenant"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="tenant">Tenant</SelectItem>
                <SelectItem value="family_member">Family member</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="First name" error={errors.first_name}>
            <Input name="first_name" defaultValue={initial?.first_name} required />
          </Field>

          <Field label="Last name" error={errors.last_name}>
            <Input name="last_name" defaultValue={initial?.last_name} required />
          </Field>

          <Field label="Email" error={errors.email}>
            <Input type="email" name="email" defaultValue={initial?.email} placeholder="optional" />
          </Field>

          <Field label="Phone" error={errors.phone}>
            <Input name="phone" defaultValue={initial?.phone} placeholder="optional" />
          </Field>

          <Field label="Move-in date" error={errors.move_in_date}>
            <Input type="date" name="move_in_date" defaultValue={initial?.move_in_date} />
          </Field>

          <Field label="Move-out date" error={errors.move_out_date}>
            <Input type="date" name="move_out_date" defaultValue={initial?.move_out_date} />
          </Field>

          <Field label="Status" error={errors.status}>
            <Select name="status" defaultValue={initial?.status ?? "active"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="former">Former</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isEditing ? "Save changes" : "Add resident"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
