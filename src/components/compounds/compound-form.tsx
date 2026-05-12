"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { compoundSchema, type CompoundInput } from "@/lib/validations/compound";
import { createCompound, updateCompound } from "@/lib/api/compounds";

interface OrgOption { id: string; name: string; }

interface CompoundFormProps {
  organizations: OrgOption[];
  initial?: Partial<CompoundInput> & { id?: string };
}

type Errors = Partial<Record<keyof CompoundInput | "form", string>>;

export function CompoundForm({ organizations, initial }: CompoundFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const editing = !!initial?.id;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);

    const candidate = {
      organization_id: String(fd.get("organization_id") ?? ""),
      name: String(fd.get("name") ?? ""),
      slug: String(fd.get("slug") ?? "").toLowerCase(),
      code: String(fd.get("code") ?? ""),
      description: String(fd.get("description") ?? ""),
      status: String(fd.get("status") ?? "active"),
      address_line1: String(fd.get("address_line1") ?? ""),
      address_line2: String(fd.get("address_line2") ?? ""),
      city: String(fd.get("city") ?? ""),
      region: String(fd.get("region") ?? ""),
      country_code: String(fd.get("country_code") ?? ""),
      postal_code: String(fd.get("postal_code") ?? ""),
      timezone: String(fd.get("timezone") ?? "UTC") || "UTC",
    };

    const parsed = compoundSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Errors = {};
      for (const [k, v] of Object.entries(flat)) {
        next[k as keyof CompoundInput] = (v ?? [])[0];
      }
      setErrors(next);
      return;
    }

    startTransition(async () => {
      try {
        if (editing && initial?.id) {
          await updateCompound(initial.id, parsed.data);
          toast.success("Compound updated");
        } else {
          await createCompound(parsed.data);
          toast.success("Compound created");
        }
        router.push("/compounds");
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
          <Field label="Organization" error={errors.organization_id} className="md:col-span-2">
            <Select name="organization_id" defaultValue={initial?.organization_id ?? organizations[0]?.id} required>
              <SelectTrigger>
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Name" error={errors.name}>
            <Input name="name" defaultValue={initial?.name} required maxLength={120} />
          </Field>
          <Field label="Slug (URL-safe id)" error={errors.slug}>
            <Input name="slug" defaultValue={initial?.slug} required placeholder="acme-marina" />
          </Field>

          <Field label="Internal code" error={errors.code}>
            <Input name="code" defaultValue={initial?.code ?? ""} placeholder="optional" />
          </Field>
          <Field label="Status" error={errors.status}>
            <Select name="status" defaultValue={initial?.status ?? "active"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Description" error={errors.description} className="md:col-span-2">
            <textarea
              name="description"
              defaultValue={initial?.description ?? ""}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>

          <Field label="Address line 1" error={errors.address_line1} className="md:col-span-2">
            <Input name="address_line1" defaultValue={initial?.address_line1 ?? ""} />
          </Field>
          <Field label="Address line 2" error={errors.address_line2} className="md:col-span-2">
            <Input name="address_line2" defaultValue={initial?.address_line2 ?? ""} />
          </Field>
          <Field label="City" error={errors.city}>
            <Input name="city" defaultValue={initial?.city ?? ""} />
          </Field>
          <Field label="Region / state" error={errors.region}>
            <Input name="region" defaultValue={initial?.region ?? ""} />
          </Field>
          <Field label="Country code (2 letters)" error={errors.country_code}>
            <Input name="country_code" defaultValue={initial?.country_code ?? ""} maxLength={2} />
          </Field>
          <Field label="Postal code" error={errors.postal_code}>
            <Input name="postal_code" defaultValue={initial?.postal_code ?? ""} />
          </Field>
          <Field label="Timezone" error={errors.timezone}>
            <Input name="timezone" defaultValue={initial?.timezone ?? "UTC"} placeholder="UTC" />
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
          {pending ? "Saving…" : editing ? "Save changes" : "Create compound"}
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
