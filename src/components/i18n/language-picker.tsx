"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { setLocale } from "@/lib/i18n/actions";
import { LOCALE_NAMES, SUPPORTED_LOCALES, type LocaleCode } from "@/lib/i18n";

interface LanguagePickerProps {
  current: LocaleCode;
  /** Render compact (icon-only) — used in the mobile shell. */
  compact?: boolean;
}

export function LanguagePicker({ current, compact = false }: LanguagePickerProps) {
  const [pending, startTransition] = useTransition();

  function change(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    startTransition(async () => { await setLocale(next); });
  }

  return (
    <label className={`relative inline-flex items-center ${compact ? "h-9 w-9" : "gap-2"} rounded-md border bg-background text-sm hover:bg-muted`}>
      <Languages className={`h-4 w-4 ${compact ? "absolute inset-0 m-auto" : "ml-2"} text-muted-foreground`} aria-hidden />
      <select
        aria-label="Language"
        value={current}
        onChange={change}
        disabled={pending}
        className={`${compact ? "h-9 w-9 opacity-0 absolute inset-0" : "h-9 bg-transparent pr-2 pl-1 outline-none"}`}
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l} dir={l === "ar" || l === "ku" ? "rtl" : "ltr"}>
            {LOCALE_NAMES[l as LocaleCode]}
          </option>
        ))}
      </select>
      {!compact && <span className="sr-only">{LOCALE_NAMES[current]}</span>}
    </label>
  );
}
