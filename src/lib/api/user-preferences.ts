/**
 * Phase 18 — per-user UI preferences (theme, accent color, locale, notification mutes).
 */
"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";

export interface UserPreferences {
  theme:         "light" | "dark" | "system";
  accent_color:  string | null;
  locale_pref:   string | null;
  notify_email:  boolean;
  notify_push:   boolean;
  notify_in_app: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme:         "system",
  accent_color:  null,
  locale_pref:   null,
  notify_email:  true,
  notify_push:   true,
  notify_in_app: true,
};

/** Returns the active user's preferences, with sensible defaults if absent. */
export async function getMyPreferences(): Promise<UserPreferences> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("user_preferences")
      .select("theme, accent_color, locale_pref, notify_email, notify_push, notify_in_app")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) return DEFAULT_PREFERENCES;
    return {
      theme:         (data.theme as UserPreferences["theme"]) ?? "system",
      accent_color:  data.accent_color  ?? null,
      locale_pref:   data.locale_pref   ?? null,
      notify_email:  data.notify_email  ?? true,
      notify_push:   data.notify_push   ?? true,
      notify_in_app: data.notify_in_app ?? true,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Persist partial preferences for the current user via the upsert RPC. */
export async function setMyPreferences(patch: Partial<UserPreferences>): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("set_user_preferences", {
    p_theme:         patch.theme         ?? null,
    p_accent_color:  patch.accent_color  ?? null,
    p_locale_pref:   patch.locale_pref   ?? null,
    p_notify_email:  patch.notify_email  ?? null,
    p_notify_push:   patch.notify_push   ?? null,
    p_notify_in_app: patch.notify_in_app ?? null,
  });
  if (error) throw new Error(error.message);
}
