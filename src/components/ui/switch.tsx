"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked:        boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?:      boolean;
  className?:     string;
  "aria-label"?:  string;
}

/**
 * Lightweight Switch toggle — no Radix dependency. Renders a styled checkbox
 * with a sliding thumb. Use for Boolean settings.
 */
export function Switch({ checked, onCheckedChange, disabled, className, "aria-label": ariaLabel }: SwitchProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-input",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200",
          checked ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5",
        )}
      />
    </label>
  );
}
