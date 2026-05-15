/**
 * Phase 18 — pure types + constants for user preferences.
 *
 * SEPARATE from user-preferences.ts because that file is "use server" and
 * Next.js 15 forbids non-async exports in server modules.
 */

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
