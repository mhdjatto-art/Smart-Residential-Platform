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
 * Format a number as currency. Defaults to USD; callers can override per
 * organization later when we add a currency setting.
 */
export function formatCurrency(
  amount: number | null | undefined,
  opts: { currency?: string; locale?: string; signed?: boolean } = {},
): string {
  if (amount === null || amount === undefined) return "—";
  const formatter = new Intl.NumberFormat(opts.locale ?? "en-US", {
    style: "currency",
    currency: opts.currency ?? "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: opts.signed ? "always" : "auto",
  });
  return formatter.format(amount);
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(digits)}%`;
}
