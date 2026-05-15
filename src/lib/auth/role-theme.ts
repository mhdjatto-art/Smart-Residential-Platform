/**
 * Phase 17C — Per-role theme accents.
 *
 * Each role gets a subtle accent color that tints the topbar role badge, the
 * sidebar logo background, and the role chip in the avatar dropdown. The base
 * primary color (org branding) stays the same — this is just a layer of
 * personalization so each user "feels" the interface is tailored to them.
 *
 * Resident gets the emerald default; admins get cooler colors (slate/violet);
 * finance/security get domain-appropriate tints.
 */
import type { AppRole } from "@/types";

export interface RoleTheme {
  /** Tailwind color class for the role chip (text + background) */
  chip:        string;
  /** Accent ring color for the sidebar logo */
  logoRing:    string;
  /** Bottom-nav active dot color */
  activeDot:   string;
  /** Tone label — used for analytics/debug */
  tone:        "neutral" | "warm" | "cool" | "earth";
}

export const ROLE_THEMES: Record<AppRole, RoleTheme> = {
  super_admin: {
    chip:      "bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200",
    logoRing:  "ring-violet-500/30",
    activeDot: "bg-violet-500",
    tone:      "cool",
  },
  developer_admin: {
    chip:      "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950/60 dark:text-fuchsia-200",
    logoRing:  "ring-fuchsia-500/30",
    activeDot: "bg-fuchsia-500",
    tone:      "cool",
  },
  compound_manager: {
    chip:      "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200",
    logoRing:  "ring-sky-500/30",
    activeDot: "bg-sky-500",
    tone:      "cool",
  },
  finance_officer: {
    chip:      "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
    logoRing:  "ring-emerald-500/30",
    activeDot: "bg-emerald-500",
    tone:      "neutral",
  },
  maintenance_staff: {
    chip:      "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
    logoRing:  "ring-amber-500/30",
    activeDot: "bg-amber-500",
    tone:      "warm",
  },
  security_staff: {
    chip:      "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200",
    logoRing:  "ring-rose-500/30",
    activeDot: "bg-rose-500",
    tone:      "warm",
  },
  resident: {
    chip:      "bg-teal-100 text-teal-900 dark:bg-teal-950/60 dark:text-teal-200",
    logoRing:  "ring-teal-500/30",
    activeDot: "bg-teal-500",
    tone:      "earth",
  },
};

/** Returns the theme for the user's primary role, with a safe default. */
export function getRoleTheme(role: AppRole | null | undefined): RoleTheme {
  if (!role) return ROLE_THEMES.resident;
  return ROLE_THEMES[role] ?? ROLE_THEMES.resident;
}
