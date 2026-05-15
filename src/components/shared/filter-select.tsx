"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/client";

interface FilterSelectProps {
  paramName: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  className?: string;
}

/** URL-synced select. Setting "all" removes the param. */
export function FilterSelect({ paramName, placeholder, options, className }: FilterSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { t } = useT();
  const current = params.get(paramName) ?? "all";

  function onChange(value: string) {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete(paramName);
    else next.set(paramName, value);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className={className}>
      <Select value={current} onValueChange={onChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("common.all")} {placeholder}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
