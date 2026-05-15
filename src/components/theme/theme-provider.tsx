"use client";

/**
 * Phase 18 — Theme + accent provider.
 *
 * Reads the user's saved preferences (passed from a server component) and:
 *   • Adds/removes `dark` class on <html> based on theme = light | dark | system
 *   • Listens to system color-scheme changes when theme = system
 *   • Sets a `--primary-override` CSS variable when accent_color is set
 *     (consumers should `color-mix` with `hsl(var(--primary))` if they want)
 *
 * Org branding still wins for the hero/branded surfaces; this is just personal flair.
 */

import { createContext, useContext, useEffect, useState } from "react";
import type { UserPreferences } from "@/lib/api/user-preferences-types";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  prefs: UserPreferences;
  setPrefs: (p: UserPreferences) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const useDark = mode === "dark" || (mode === "system" && systemDark);
  root.classList.toggle("dark", useDark);
  root.style.colorScheme = useDark ? "dark" : "light";
}

function applyAccent(hex: string | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!hex) {
    root.style.removeProperty("--accent-override");
    return;
  }
  // Sanitize: only allow #RRGGBB
  const safe = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : null;
  if (!safe) {
    root.style.removeProperty("--accent-override");
    return;
  }
  root.style.setProperty("--accent-override", safe);
}

export function ThemeProvider({
  initial,
  children,
}: {
  initial: UserPreferences;
  children: React.ReactNode;
}) {
  const [prefs, setPrefs] = useState<UserPreferences>(initial);

  // Apply on mount + whenever theme changes
  useEffect(() => {
    applyTheme(prefs.theme);
    applyAccent(prefs.accent_color);
  }, [prefs.theme, prefs.accent_color]);

  // Listen to system color-scheme changes when theme = system
  useEffect(() => {
    if (prefs.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [prefs.theme]);

  return (
    <ThemeContext.Provider value={{ prefs, setPrefs }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Hook for reading/updating the user's theme prefs in-session. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
