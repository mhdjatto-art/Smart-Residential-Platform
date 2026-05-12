"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { brandingSchema } from "@/lib/validations/saas";
import { upsertBranding, type BrandingRow } from "@/lib/api/saas";

interface BrandingFormProps {
  orgId: string;
  initial: BrandingRow | null;
}

export function BrandingForm({ orgId, initial }: BrandingFormProps) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [primary, setPrimary] = useState(initial?.primary_color ?? "#0B1F3A");
  const [accent,  setAccent]  = useState(initial?.accent_color  ?? "#10B981");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const candidate = {
      organization_id: orgId,
      logo_path: String(fd.get("logo_path") ?? ""),
      logo_dark_path: String(fd.get("logo_dark_path") ?? ""),
      favicon_path: String(fd.get("favicon_path") ?? ""),
      primary_color: primary,
      accent_color:  accent,
      background_color: String(fd.get("background_color") ?? ""),
      font_family: String(fd.get("font_family") ?? "Inter"),
      custom_css: String(fd.get("custom_css") ?? ""),
      email_from_name: String(fd.get("email_from_name") ?? ""),
      email_footer: String(fd.get("email_footer") ?? ""),
    };
    const parsed = brandingSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) next[k] = (v ?? [])[0]!;
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        await upsertBranding(parsed.data);
        toast.success("Branding saved");
      } catch (err) {
        toast.error("Save failed", { description: err instanceof Error ? err.message : "" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Primary color</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-12 rounded border" />
              <Input value={primary} onChange={(e) => setPrimary(e.target.value)} />
            </div>
            {errors.primary_color && <p className="text-xs text-destructive">{errors.primary_color}</p>}
          </div>
          <div className="space-y-2">
            <Label>Accent color</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-12 rounded border" />
              <Input value={accent} onChange={(e) => setAccent(e.target.value)} />
            </div>
            {errors.accent_color && <p className="text-xs text-destructive">{errors.accent_color}</p>}
          </div>

          <div className="space-y-2">
            <Label>Font family</Label>
            <Input name="font_family" defaultValue={initial?.font_family ?? "Inter"} />
          </div>
          <div className="space-y-2">
            <Label>Background tone</Label>
            <Input name="background_color" defaultValue={initial?.background_color ?? ""} placeholder="optional CSS color" />
          </div>

          <div className="space-y-2">
            <Label>Logo (light) URL</Label>
            <Input name="logo_path" defaultValue={initial?.logo_path ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Logo (dark) URL</Label>
            <Input name="logo_dark_path" defaultValue={initial?.logo_dark_path ?? ""} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Favicon URL</Label>
            <Input name="favicon_path" defaultValue={initial?.favicon_path ?? ""} />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Custom CSS</Label>
            <Textarea name="custom_css" rows={5} defaultValue={initial?.custom_css ?? ""} placeholder=".srp-brand { ... }" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Email &quot;From&quot; name</Label>
            <Input name="email_from_name" defaultValue={initial?.email_from_name ?? ""} placeholder="e.g. Tigris Residential" />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Email footer</Label>
            <Textarea name="email_footer" rows={3} defaultValue={initial?.email_footer ?? ""} placeholder="Contact info, social links, legal." />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save branding"}</Button>
      </div>
    </form>
  );
}
