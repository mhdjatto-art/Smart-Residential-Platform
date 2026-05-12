/**
 * Lightweight i18n scaffolding for SRP.
 *
 * Why custom (vs next-intl, i18next, ...): we need (a) zero new dependencies,
 * (b) tenant-aware locale resolution (each org has a `default_locale` in
 * `organization_settings`), and (c) RTL flip support. The scaffold here is
 * intentionally minimal — drop in a real translator later by replacing the
 * resolver in `translate()`.
 */

import type en from "./locales/en.json";

export type LocaleCode = "en" | "ar" | "ku" | "fr" | "es";

export const SUPPORTED_LOCALES: readonly LocaleCode[] = ["en", "ar", "ku", "fr", "es"];
export const RTL_LOCALES: ReadonlySet<LocaleCode> = new Set<LocaleCode>(["ar", "ku"]);

export const LOCALE_NAMES: Record<LocaleCode, string> = {
  en: "English",
  ar: "العربية",
  ku: "کوردی",
  fr: "Français",
  es: "Español",
};

export function isRtl(locale: LocaleCode): boolean {
  return RTL_LOCALES.has(locale);
}

export function htmlDir(locale: LocaleCode): "rtl" | "ltr" {
  return isRtl(locale) ? "rtl" : "ltr";
}

type Dict = typeof en;
type DotPath<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends object
    ? DotPath<T[K], P extends "" ? K : `${P}.${K}`>
    : P extends "" ? K : `${P}.${K}`;
}[keyof T & string];
export type TranslationKey = DotPath<Dict>;

const loaded = new Map<LocaleCode, Dict>();

export async function loadLocale(locale: LocaleCode): Promise<Dict> {
  if (loaded.has(locale)) return loaded.get(locale)!;
  // Eager-bundle the en dict since it's the fallback. Other locales are
  // loaded on demand. We load them via dynamic import so the bundler can
  // split them; if a locale file is missing we fall back to en.
  let dict: Dict;
  try {
    if (locale === "en") {
      dict = (await import("./locales/en.json")).default as Dict;
    } else if (locale === "ar") {
      dict = (await import("./locales/ar.json")).default as Dict;
    } else {
      dict = (await import("./locales/en.json")).default as Dict;
    }
  } catch {
    dict = (await import("./locales/en.json")).default as Dict;
  }
  loaded.set(locale, dict);
  return dict;
}

export function resolveKey(dict: Dict, key: TranslationKey): string {
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = dict;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur === undefined) return key;
  }
  return typeof cur === "string" ? cur : key;
}

/** Synchronous translation factory. Call `await loadLocale(...)` first. */
export function makeT(dict: Dict) {
  return function t(key: TranslationKey, params: Record<string, string | number> = {}): string {
    let s = resolveKey(dict, key);
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
    return s;
  };
}
