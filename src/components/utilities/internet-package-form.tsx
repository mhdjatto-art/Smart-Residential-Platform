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

interface ProviderOption { id: string; name: string; }
interface InternetPackageFormProps { providers: ProviderOption[]; }

export function InternetPackageForm({ providers }: InternetPackageFormProps) {
  const router = useRouter();
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
      currency: String(fd.get("currency") ?? "USD"),
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
        toast.success("Package created");
        router.push("/internet-packages");
        router.refresh();
      } catch (err) {
        toast.error("Save failed", { description: err instanceof Error ? err.message : "" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-2">
          <div className="md:col-span-2 space-y-2">
            <Label>Provider</Label>
            <Select name="provider_id" defaultValue={providers[0]?.id} required>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Package name</Label>
            <Input name="package_name" required placeholder="e.g. Fiber 100/20" />
            {errors.package_name && <p className="text-xs text-destructive">{errors.package_name}</p>}
          </div>
          <div className="space-y-2">
            <Label>Tier</Label>
            <Select name="package_tier" defaultValue="standard">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Download speed (Mbps)</Label>
            <Input name="speed_mbps_down" type="number" required />
            {errors.speed_mbps_down && <p className="text-xs text-destructive">{errors.speed_mbps_down}</p>}
          </div>
          <div className="space-y-2">
            <Label>Upload speed (Mbps)</Label>
            <Input name="speed_mbps_up" type="number" placeholder="optional" />
          </div>

          <div className="space-y-2">
            <Label>Data cap (GB)</Label>
            <Input name="data_cap_gb" type="number" placeholder="0 = unlimited" />
          </div>
          <div className="space-y-2">
            <Label>Monthly price</Label>
            <Input name="monthly_price" type="number" step="0.01" required />
            {errors.monthly_price && <p className="text-xs text-destructive">{errors.monthly_price}</p>}
          </div>

          <div className="space-y-2">
            <Label>Currency</Label>
            <Select name="currency" defaultValue="USD">
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
            <Label>Suspension policy</Label>
            <Select name="suspension_policy" defaultValue="after_grace">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate on non-payment</SelectItem>
                <SelectItem value="after_grace">After grace period</SelectItem>
                <SelectItem value="manual">Manual only</SelectItem>
                <SelectItem value="never">Never auto-suspend</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Description</Label>
            <Textarea name="description" rows={3} placeholder="Optional notes about the package." />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Create package"}</Button>
      </div>
    </form>
  );
}
