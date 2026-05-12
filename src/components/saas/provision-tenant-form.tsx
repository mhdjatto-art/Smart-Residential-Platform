"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { provisionOrganizationSchema, SUPPORTED_LOCALES } from "@/lib/validations/saas";
import { provisionOrganization } from "@/lib/api/saas";
import { formatCurrency } from "@/lib/utils";

interface PlanOption { code: string; name: string; monthly: number; currency: string; }

interface ProvisionTenantFormProps { plans: PlanOption[]; }

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

export function ProvisionTenantForm({ plans }: ProvisionTenantFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const candidate = {
      name,
      slug: slug || slugify(name),
      plan_code: String(fd.get("plan_code") ?? "starter"),
      contact_email: String(fd.get("contact_email") ?? ""),
      country_code: String(fd.get("country_code") ?? ""),
      default_locale: String(fd.get("default_locale") ?? "en"),
      timezone: String(fd.get("timezone") ?? "UTC"),
    };
    const parsed = provisionOrganizationSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) next[k] = (v ?? [])[0]!;
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        await provisionOrganization(parsed.data);
        toast.success("Tenant provisioned");
        router.push("/saas-console");
        router.refresh();
      } catch (err) {
        toast.error("Provision failed", { description: err instanceof Error ? err.message : "" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Organization name</Label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }}
              required
              placeholder="e.g. Tigris Residential Group"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} required />
            <p className="text-[11px] text-muted-foreground">Used in URLs and the default domain ({slug || "your-slug"}.srp.app)</p>
            {errors.slug && <p className="text-xs text-destructive">{errors.slug}</p>}
          </div>

          <div className="space-y-2">
            <Label>Plan</Label>
            <Select name="plan_code" defaultValue={plans[0]?.code ?? "starter"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.name} — {formatCurrency(p.monthly, { currency: p.currency })}/mo
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Contact email</Label>
            <Input name="contact_email" type="email" />
          </div>

          <div className="space-y-2">
            <Label>Country code (ISO)</Label>
            <Input name="country_code" maxLength={3} placeholder="IQ, AE, US…" />
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Input name="timezone" defaultValue="UTC" placeholder="Asia/Baghdad, UTC, …" />
          </div>

          <div className="space-y-2">
            <Label>Default locale</Label>
            <Select name="default_locale" defaultValue="en">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUPPORTED_LOCALES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Provisioning…" : "Provision tenant"}</Button>
      </div>
    </form>
  );
}
