import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes, deduping conflicts. Used everywhere a component
 * accepts a `className` prop that needs to win over its default classes.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "Marius D." → "MD" — for avatar fallbacks. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export function formatDate(d: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...opts,
  }).format(date);
}

export function assertNever(x: never, label = "value"): never {
  throw new Error(`Unhandled ${label}: ${JSON.stringify(x)}`);
}

/**
 * Currency definitions for the supported set. IQD is shown without decimals
 * by convention (sub-unit "fils" is not used in practice). Other currencies
 * follow the standard 2-decimal convention.
 */
const CURRENCY_CONFIG: Record<string, { locale: string; decimals: number }> = {
  USD: { locale: "en-US", decimals: 2 },
  IQD: { locale: "en-US", decimals: 0 },   // 1,000,000 IQD (no fils in commerce)
  EUR: { locale: "en-IE", decimals: 2 },
  GBP: { locale: "en-GB", decimals: 2 },
  SAR: { locale: "en-SA", decimals: 2 },
  AED: { locale: "en-AE", decimals: 2 },
  EGP: { locale: "en-EG", decimals: 2 },
  JOD: { locale: "en-JO", decimals: 3 },
  KWD: { locale: "en-KW", decimals: 3 },
  QAR: { locale: "en-QA", decimals: 2 },
  BHD: { locale: "en-BH", decimals: 3 },
  OMR: { locale: "en-OM", decimals: 3 },
  TRY: { locale: "en-US", decimals: 2 },
};

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_CONFIG);

/**
 * Format a number as currency. The currency code is required for accuracy —
 * callers should pull it from the contract or organization context.
 */
export function formatCurrency(
  amount: number | null | undefined,
  opts: { currency?: string; locale?: string; signed?: boolean } = {},
): string {
  if (amount === null || amount === undefined) return "—";
  const code = (opts.currency ?? "USD").toUpperCase();
  const cfg = CURRENCY_CONFIG[code] ?? CURRENCY_CONFIG.USD!;
  try {
    const formatter = new Intl.NumberFormat(opts.locale ?? cfg.locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: cfg.decimals,
      maximumFractionDigits: cfg.decimals,
      signDisplay: opts.signed ? "always" : "auto",
    });
    return formatter.format(amount);
  } catch {
    // Fallback for unknown currency codes
    return `${code} ${amount.toFixed(cfg.decimals)}`;
  }
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(digits)}%`;
}
