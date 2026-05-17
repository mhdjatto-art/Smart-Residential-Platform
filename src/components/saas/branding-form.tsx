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
import { BrandingImageUpload } from "@/components/saas/branding-image-upload";

interface BrandingFormProps {
  orgId: string;
  initial: BrandingRow | null;
}

/**
 * Branding admin form. Lets super_admin / developer_admin / compound_manager
 * tweak every white-label dimension for their tenant:
 *   - Colors (primary, accent, background)
 *   - Typography
 *   - Images (logo, dark logo, favicon, login hero)
 *   - Login welcome text in 3 languages (en, ar, ku)
 *   - Email From-name + footer
 *   - Free-form custom CSS overrides
 *
 * The form is plain HTML form-data — file uploads happen out-of-band via the
 * <BrandingImageUpload /> child component which writes a URL into a hidden
 * field that the form picks up on submit.
 */
export function BrandingForm({ orgId, initial }: BrandingFormProps) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [primary, setPrimary] = useState(initial?.primary_color ?? "#0B1F3A");
  const [accent,  setAccent]  = useState(initial?.accent_color  ?? "#10B981");

  // Initial multi-language welcome text. JSONB column may be null.
  const initialTitle    = (initial?.login_welcome_title    ?? {}) as Record<string,string>;
  const initialSubtitle = (initial?.login_welcome_subtitle ?? {}) as Record<string,string>;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);

    // Assemble the multi-language objects from the three per-locale inputs.
    const welcomeTitle: Record<string, string> = {};
    const welcomeSubtitle: Record<string, string> = {};
    for (const lang of ["en","ar","ku"] as const) {
      const t = String(fd.get(`login_welcome_title_${lang}`) ?? "").trim();
      const s = String(fd.get(`login_welcome_subtitle_${lang}`) ?? "").trim();
      if (t) welcomeTitle[lang] = t;
      if (s) welcomeSubtitle[lang] = s;
    }

    const candidate = {
      organization_id: orgId,
      logo_path:       String(fd.get("logo_path") ?? ""),
      logo_dark_path:  String(fd.get("logo_dark_path") ?? ""),
      favicon_path:    String(fd.get("favicon_path") ?? ""),
      primary_color:   primary,
      accent_color:    accent,
      background_color: String(fd.get("background_color") ?? ""),
      font_family:     String(fd.get("font_family") ?? "Inter"),
      custom_css:      String(fd.get("custom_css") ?? ""),
      email_from_name: String(fd.get("email_from_name") ?? ""),
      email_footer:    String(fd.get("email_footer") ?? ""),
      // Phase 25 — login page customisation
      login_hero_path:        String(fd.get("login_hero_path") ?? ""),
      login_welcome_title:    welcomeTitle,
      login_welcome_subtitle: welcomeSubtitle,
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
      {/* ─── Colors + typography ─── */}
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
        </CardContent>
      </Card>

      {/* ─── Images ─── */}
      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Brand images
            </h3>
          </div>

          <div className="space-y-2">
            <Label>Logo (light backgrounds)</Label>
            <BrandingImageUpload
              name="logo_path"
              kind="logo"
              orgId={orgId}
              defaultUrl={initial?.logo_path}
              hint="Shown in the topbar on light theme. PNG/SVG recommended, max 5 MB."
            />
          </div>
          <div className="space-y-2">
            <Label>Logo (dark backgrounds)</Label>
            <BrandingImageUpload
              name="logo_dark_path"
              kind="logo_dark"
              orgId={orgId}
              defaultUrl={initial?.logo_dark_path}
              hint="Shown on the login page and dark theme. Optional — falls back to the light logo."
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Favicon</Label>
            <BrandingImageUpload
              name="favicon_path"
              kind="favicon"
              orgId={orgId}
              defaultUrl={initial?.favicon_path}
              hint="32×32 or 64×64 PNG. Used in the browser tab."
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Login page ─── */}
      <Card>
        <CardContent className="grid gap-6 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Login page
          </h3>

          <div className="space-y-2">
            <Label>Hero / background image</Label>
            <BrandingImageUpload
              name="login_hero_path"
              kind="login_hero"
              orgId={orgId}
              defaultUrl={initial?.login_hero_path}
              aspect="wide"
              hint="Shown behind the sign-in card. 1920×1080 JPG/WebP works well."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {(["en","ar","ku"] as const).map((lang) => (
              <div key={lang} className="space-y-2">
                <Label>Welcome title — {lang.toUpperCase()}</Label>
                <Input
                  name={`login_welcome_title_${lang}`}
                  defaultValue={initialTitle[lang] ?? ""}
                  placeholder={lang === "ar" ? "أهلاً بك في تطبيقنا" : lang === "ku" ? "بەخێر بێیت" : "Welcome to your community"}
                  dir={lang === "ar" || lang === "ku" ? "rtl" : "ltr"}
                />
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {(["en","ar","ku"] as const).map((lang) => (
              <div key={lang} className="space-y-2">
                <Label>Subtitle — {lang.toUpperCase()}</Label>
                <Textarea
                  name={`login_welcome_subtitle_${lang}`}
                  rows={3}
                  defaultValue={initialSubtitle[lang] ?? ""}
                  placeholder={lang === "ar" ? "ادفع الفواتير، اطلب الصيانة، تواصل مع الإدارة" : lang === "ku" ? "پارەی پسولە بدە و خزمەتگوزاری داوا بکە" : "Pay bills, request maintenance, stay connected."}
                  dir={lang === "ar" || lang === "ku" ? "rtl" : "ltr"}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Email ─── */}
      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground md:col-span-2">
            Email
          </h3>
          <div className="space-y-2">
            <Label>From name</Label>
            <Input name="email_from_name" defaultValue={initial?.email_from_name ?? ""} placeholder="e.g. Tigris Residential" />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Footer</Label>
            <Textarea name="email_footer" rows={3} defaultValue={initial?.email_footer ?? ""} placeholder="Contact info, social links, legal." />
          </div>
        </CardContent>
      </Card>

      {/* ─── Advanced ─── */}
      <Card>
        <CardContent className="grid gap-6 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Advanced — custom CSS
          </h3>
          <Textarea
            name="custom_css"
            rows={6}
            defaultValue={initial?.custom_css ?? ""}
            placeholder=":root { --srp-radius: 8px; } .srp-brand { ... }"
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            Injected globally as the last stylesheet. Use sparingly — anything you write here ships to every user of this tenant.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save branding"}</Button>
      </div>
    </form>
  );
}
