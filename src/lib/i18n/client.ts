"use client";

import { useEffect, useState } from "react";
import {
  loadLocale, makeT, SUPPORTED_LOCALES,
  type LocaleCode, type TranslationKey,
} from "./index";

function readLocaleFromHtml(): LocaleCode {
  if (typeof document === "undefined") return "en";
  const lang = document.documentElement.lang;
  if (lang && (SUPPORTED_LOCALES as readonly string[]).includes(lang)) return lang as LocaleCode;
  return "en";
}

/**
 * Client-side translation hook. Reads the current locale from `<html lang>`
 * (set by the server layout based on the cookie), loads the dict on demand,
 * and returns a `t(key)` function. Renders untranslated keys until the dict
 * loads — usually a single microtask.
 *
 * For server components, use `getT()` from `@/lib/i18n/server` instead.
 */
export function useT() {
  const [locale, setLocale] = useState<LocaleCode>(() => readLocaleFromHtml());
  const [dict, setDict] = useState<Awaited<ReturnType<typeof loadLocale>> | null>(null);

  useEffect(() => {
    let active = true;
    loadLocale(locale).then((d) => { if (active) setDict(d); });
    return () => { active = false; };
  }, [locale]);

  // If the cookie changes via the picker, the layout reloads — but for SPA
  // transitions we also watch the html lang attribute.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const obs = new MutationObserver(() => setLocale(readLocaleFromHtml()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => obs.disconnect();
  }, []);

  const t = dict ? makeT(dict) : ((key: TranslationKey) => key);
  return { t, locale };
}
