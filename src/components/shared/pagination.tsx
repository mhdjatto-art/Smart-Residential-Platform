"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

interface PaginationProps {
  total: number;
  pageSize: number;
  page: number;
}

export function Pagination({ total, pageSize, page }: PaginationProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { t } = useT();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function pageUrl(p: number) {
    const next = new URLSearchParams(params);
    if (p === 1) next.delete("page");
    else next.set("page", String(p));
    return `${pathname}?${next.toString()}`;
  }

  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">{page}</span> / {totalPages} · {total} {t("common.total")}
      </p>
      <div className="flex items-center gap-1">
        <Button asChild variant="outline" size="sm" disabled={page <= 1}>
          <Link href={pageUrl(Math.max(1, page - 1))} aria-disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" />
            {t("actions.previous")}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
          <Link href={pageUrl(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages}>
            {t("actions.next")}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
