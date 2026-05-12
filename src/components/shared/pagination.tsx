"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  total: number;
  pageSize: number;
  page: number;
}

export function Pagination({ total, pageSize, page }: PaginationProps) {
  const pathname = usePathname();
  const params = useSearchParams();
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
        Page <span className="font-medium text-foreground">{page}</span> of {totalPages} · {total} total
      </p>
      <div className="flex items-center gap-1">
        <Button asChild variant="outline" size="sm" disabled={page <= 1}>
          <Link href={pageUrl(Math.max(1, page - 1))} aria-disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
          <Link href={pageUrl(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
