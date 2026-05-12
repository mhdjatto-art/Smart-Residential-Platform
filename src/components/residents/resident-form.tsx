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

interface CompoundOption { id: string; name: string; }

interface ResidentFormProps {
  compounds: CompoundOption[];
  initial?: Partial<ResidentInput> & { id?: string };
  defaultCompoundId?: string;
}

type Errors = Partial<Record<keyof ResidentInput | "form", string>>;

export function ResidentForm({ compounds, initial, defaultCompoundId }: ResidentFormProps) {
  const router = useRouter();
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
          toast.success("Resident updated");
          router.push(`/residents/${initial.id}`);
        } else {
          const created = await createResident(parsed.data);
          toast.success("Resident created");
          router.push(`/residents/${created.id}`);
        }
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setErrors({ form: msg });
        toast.error("Save failed", { description: msg });
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
                {compounds.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
            <Input type="email" name="email" defaultValue={initial?.email ?? ""} />
          </Field>
          <Field label="Mobile" error={errors.mobile}>
            <Input name="mobile" defaultValue={initial?.mobile ?? ""} placeholder="+971…" />
          </Field>

          <Field label="National ID" error={errors.national_id}>
            <Input name="national_id" defaultValue={initial?.national_id ?? ""} />
          </Field>
          <Field label="Gender" error={errors.gender}>
            <Select name="gender" defaultValue={initial?.gender ?? "unspecified"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="unspecified">Unspecified</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Date of birth" error={errors.date_of_birth}>
            <Input type="date" name="date_of_birth" defaultValue={initial?.date_of_birth ?? ""} />
          </Field>
          <Field label="Occupation" error={errors.occupation}>
            <Input name="occupation" defaultValue={initial?.occupation ?? ""} />
          </Field>

          <Field label="Tenancy type" error={errors.tenancy_type}>
            <Select name="tenancy_type" defaultValue={initial?.tenancy_type ?? "tenant"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="tenant">Tenant</SelectItem>
                <SelectItem value="family_member">Family member</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Status" error={errors.status}>
            <Select name="status" defaultValue={initial?.status ?? "active"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="former">Former</SelectItem>
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
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Create resident"}
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
