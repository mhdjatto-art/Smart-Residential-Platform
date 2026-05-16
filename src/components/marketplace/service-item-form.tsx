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
import { serviceItemSchema, SERVICE_KINDS } from "@/lib/validations/marketplace";
import { createServiceItem } from "@/lib/api/marketplace";

interface CategoryOption { id: string; name: string; }
interface ServiceItemFormProps {
  provider: { id: string; organization_id: string; provider_name: string };
  categories: CategoryOption[];
}

export function ServiceItemForm({ provider, categories }: ServiceItemFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const category_id_raw = String(fd.get("category_id") ?? "");
    const candidate = {
      organization_id: provider.organization_id,
      provider_id: provider.id,
      category_id: category_id_raw === "__none__" ? "" : category_id_raw,
      name: String(fd.get("name") ?? ""),
      slug: "",
      description: String(fd.get("description") ?? ""),
      service_kind: String(fd.get("service_kind") ?? "on_demand_service"),
      price: Number(fd.get("price") ?? 0),
      currency: String(fd.get("currency") ?? "IQD"),
      duration_minutes: fd.get("duration_minutes") ? Number(fd.get("duration_minutes")) : undefined,
      unit: String(fd.get("unit") ?? ""),
      is_active: true,
    };
    const parsed = serviceItemSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) next[k] = (v ?? [])[0]!;
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        await createServiceItem(parsed.data);
        toast.success("Service / product added");
        router.push(`/service-providers/${provider.id}`);
        router.refresh();
      } catch (err) {
        toast.error("Save failed", { description: err instanceof Error ? err.message : "" });
        setErrors({ form: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input name="name" required placeholder="e.g. Apartment deep clean (2BHK)" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label>Kind</Label>
            <Select name="service_kind" defaultValue="on_demand_service">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICE_KINDS.map((k) => <SelectItem key={k} value={k}>{k.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Price</Label>
            <Input name="price" type="number" step="0.01" required />
            {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
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
            <Label>Duration (minutes)</Label>
            <Input name="duration_minutes" type="number" placeholder="optional" />
          </div>
          <div className="space-y-2">
            <Label>Unit</Label>
            <Input name="unit" placeholder="item, hour, kg, …" />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Category</Label>
            <Select name="category_id" defaultValue="__none__">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Description</Label>
            <Textarea name="description" rows={3} />
          </div>
        </CardContent>
      </Card>

      {errors.form && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errors.form}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add"}</Button>
      </div>
    </form>
  );
}
