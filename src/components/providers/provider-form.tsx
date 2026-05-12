"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { providerSchema, UTILITY_TYPES, type ProviderInput } from "@/lib/validations/utilities";
import { createProvider } from "@/lib/api/utilities";

interface OrgOption { id: string; name: string; }

interface ProviderFormProps {
  organizations: OrgOption[];
}

export function ProviderForm({ organizations }: ProviderFormProps) {
  const router = useRouter();
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
      provider_type: String(fd.get("provider_type") ?? "electricity"),
      provider_code: String(fd.get("provider_code") ?? ""),
      billing_method: String(fd.get("billing_method") ?? "flat"),
      tariff_type: String(fd.get("tariff_type") ?? "fixed"),
      provider_status: "active",
      contact_name: String(fd.get("contact_name") ?? ""),
      contact_email: String(fd.get("contact_email") ?? ""),
      contact_phone: String(fd.get("contact_phone") ?? ""),
      adapter_kind: String(fd.get("adapter_kind") ?? "").replace("__none__", ""),
    };
    const parsed = providerSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) next[k] = (v ?? [])[0]!;
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        await createProvider(parsed.data);
        toast.success("Provider added");
        router.push("/providers");
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
          <div className="md:col-span-2 space-y-2">
            <Label>Organization</Label>
            <Select name="organization_id" defaultValue={organizations[0]?.id} required>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {organizations.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Provider name</Label>
            <Input name="provider_name" required placeholder="e.g. Dubai Electricity & Water Authority" />
            {errors.provider_name && <p className="text-xs text-destructive">{errors.provider_name}</p>}
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select name="provider_type" defaultValue="electricity">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UTILITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Code</Label>
            <Input name="provider_code" placeholder="optional internal code" />
          </div>
          <div className="space-y-2">
            <Label>Billing method</Label>
            <Select name="billing_method" defaultValue="flat">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">Flat fee</SelectItem>
                <SelectItem value="metered">Metered</SelectItem>
                <SelectItem value="tiered">Tiered</SelectItem>
                <SelectItem value="time_of_use">Time of use</SelectItem>
                <SelectItem value="package">Package</SelectItem>
                <SelectItem value="pay_per_use">Pay per use</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Contact name</Label>
            <Input name="contact_name" />
          </div>
          <div className="space-y-2">
            <Label>Contact phone</Label>
            <Input name="contact_phone" />
          </div>
          <div className="space-y-2">
            <Label>Contact email</Label>
            <Input type="email" name="contact_email" />
          </div>

          <div className="space-y-2">
            <Label>Adapter (future IoT integration)</Label>
            <Select name="adapter_kind" defaultValue="__none__">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None (manual) —</SelectItem>
                <SelectItem value="modbus">Modbus</SelectItem>
                <SelectItem value="mqtt">MQTT</SelectItem>
                <SelectItem value="rs485">RS485</SelectItem>
                <SelectItem value="lorawan">LoRaWAN</SelectItem>
                <SelectItem value="mikrotik">MikroTik API</SelectItem>
                <SelectItem value="unifi">UniFi API</SelectItem>
                <SelectItem value="radius">RADIUS</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              The system is integration-ready. Live hardware/API hookup is configured later.
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
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add provider"}</Button>
      </div>
    </form>
  );
}
