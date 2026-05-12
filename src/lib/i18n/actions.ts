"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SUPPORTED_LOCALES, type LocaleCode } from "./index";

const COOKIE = "srp.locale";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Server action to set the active locale. Called from the language picker.
 *
 * We use a cookie (not localStorage) so the value is available in the very
 * first server render — no flash of English UI when an Arabic-preferring
 * user opens the app.
 */
export async function setLocale(next: string): Promise<void> {
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(next)) return;
  const c = await cookies();
  c.set(COOKIE, next as LocaleCode, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: false,         // also readable by client JS for client-only screens
  });
  revalidatePath("/", "layout");
}
