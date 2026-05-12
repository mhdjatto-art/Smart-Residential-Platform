import "server-only";
import { cookies, headers } from "next/headers";
import { loadLocale, makeT, SUPPORTED_LOCALES, htmlDir, type LocaleCode, type TranslationKey } from "./index";

const COOKIE = "srp.locale";

/**
 * Resolve the active locale for the current request.
 *
 * Order of preference:
 *   1. `srp.locale` cookie (user picked it explicitly via the picker)
 *   2. `Accept-Language` header (browser preference)
 *   3. "en"
 *
 * Per-tenant defaults from `organization_settings.default_locale` are
 * applied client-side after login — we don't read the DB here to keep
 * the hot path fast.
 */
export async function getActiveLocale(): Promise<LocaleCode> {
  try {
    const c = await cookies();
    const cookieValue = c.get(COOKIE)?.value;
    if (cookieValue && (SUPPORTED_LOCALES as readonly string[]).includes(cookieValue)) {
      return cookieValue as LocaleCode;
    }
    const h = await headers();
    const al = h.get("accept-language") ?? "";
    const first = al.split(",")[0]?.split("-")[0]?.toLowerCase() ?? "";
    if ((SUPPORTED_LOCALES as readonly string[]).includes(first)) return first as LocaleCode;
  } catch {
    // headers()/cookies() aren't available outside a request — fall through to en.
  }
  return "en";
}

/** Server-side translator. Loads the active locale dict and returns a `t()` fn. */
export async function getT() {
  const locale = await getActiveLocale();
  const dict = await loadLocale(locale);
  const t = makeT(dict);
  return { t, locale, dir: htmlDir(locale) as "rtl" | "ltr" };
}

export type T = (key: TranslationKey, params?: Record<string, string | number>) => string;
