"use client";

/**
 * Phase 18 — Settings form for personal theme + accent + notification mutes.
 * Mounted inside both the desktop /settings page and the mobile /m/profile page.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Moon, Monitor, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTheme } from "./theme-provider";
import { setMyPreferences } from "@/lib/api/user-preferences";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const ACCENT_PRESETS: { hex: string; name: string }[] = [
  { hex: "#10b981", name: "Emerald" },
  { hex: "#0ea5e9", name: "Sky" },
  { hex: "#8b5cf6", name: "Violet" },
  { hex: "#ec4899", name: "Pink" },
  { hex: "#f59e0b", name: "Amber" },
  { hex: "#ef4444", name: "Rose" },
  { hex: "#14b8a6", name: "Teal" },
  { hex: "#6366f1", name: "Indigo" },
];

export function ThemeSettingsForm() {
  const { prefs, setPrefs } = useTheme();
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [custom, setCustom] = useState(prefs.accent_color ?? "");

  function save(patch: Partial<typeof prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);                       // optimistic update
    startTransition(async () => {
      try {
        await setMyPreferences(patch);
        toast.success(t("settings.saved"));
      } catch (e) {
        toast.error(t("settings.save_failed"), { description: e instanceof Error ? e.message : "" });
        setPrefs(prefs); // rollback
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Theme mode */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.theme_title")}</CardTitle>
          <CardDescription>{t("settings.theme_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: "light",  Icon: Sun,     label: t("settings.theme_light") },
              { value: "dark",   Icon: Moon,    label: t("settings.theme_dark") },
              { value: "system", Icon: Monitor, label: t("settings.theme_system") },
            ] as const).map(({ value, Icon, label }) => {
              const active = prefs.theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => save({ theme: value })}
                  disabled={pending}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 transition-all active:scale-95",
                    active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted/50",
                  )}
                  aria-pressed={active}
                >
                  <Icon className={cn("h-6 w-6", active && "text-primary")} />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Accent color */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.accent_title")}</CardTitle>
          <CardDescription>{t("settings.accent_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {ACCENT_PRESETS.map((c) => {
              const active = prefs.accent_color === c.hex;
              return (
                <button
                  key={c.hex}
                  type="button"
                  title={c.name}
                  onClick={() => { setCustom(c.hex); save({ accent_color: c.hex }); }}
                  disabled={pending}
                  className={cn(
                    "relative flex h-12 w-full items-center justify-center rounded-xl transition-all active:scale-90 hover:scale-105",
                    active && "ring-4 ring-offset-2 ring-offset-background",
                  )}
                  style={{ backgroundColor: c.hex, boxShadow: active ? `0 0 0 2px ${c.hex}` : undefined }}
                  aria-label={`${c.name} accent`}
                >
                  {active && <Check className="h-5 w-5 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={custom || "#10b981"}
              onChange={(e) => setCustom(e.target.value)}
              onBlur={() => { if (custom && /^#[0-9a-fA-F]{6}$/.test(custom)) save({ accent_color: custom }); }}
              className="h-9 w-9 cursor-pointer rounded border"
              aria-label="Custom hex color"
            />
            <input
              type="text"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="#10b981"
              className="h-9 w-32 rounded border bg-background px-2 font-mono text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setCustom(""); save({ accent_color: null }); }}
              disabled={pending}
            >
              {t("settings.reset_default")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications mutes */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.notifications_title")}</CardTitle>
          <CardDescription>{t("settings.notifications_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label={t("settings.notify_email")}  checked={prefs.notify_email}  onChange={(v) => save({ notify_email:  v })} />
          <Row label={t("settings.notify_push")}   checked={prefs.notify_push}   onChange={(v) => save({ notify_push:   v })} />
          <Row label={t("settings.notify_in_app")} checked={prefs.notify_in_app} onChange={(v) => save({ notify_in_app: v })} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
