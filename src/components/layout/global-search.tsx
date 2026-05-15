"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, X, Loader2, User, Home, FileText, CreditCard, Wrench, Cable, ArrowRight,
} from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n";

interface Hit {
  type:     "resident" | "unit" | "contract" | "payment" | "ticket" | "provider";
  id:       string;
  title:    string;
  subtitle?: string;
  href:     string;
}

const TYPE_ICONS = {
  resident: User,
  unit:     Home,
  contract: FileText,
  payment:  CreditCard,
  ticket:   Wrench,
  provider: Cable,
};

const TYPE_LABEL_KEYS: Record<Hit["type"], string> = {
  resident: "search.type_resident",
  unit:     "search.type_unit",
  contract: "search.type_contract",
  payment:  "search.type_payment",
  ticket:   "search.type_ticket",
  provider: "search.type_provider",
};

const TYPE_TONE: Record<Hit["type"], string> = {
  resident: "text-violet-600 dark:text-violet-400",
  unit:     "text-sky-600 dark:text-sky-400",
  contract: "text-emerald-600 dark:text-emerald-400",
  payment:  "text-amber-600 dark:text-amber-400",
  ticket:   "text-rose-600 dark:text-rose-400",
  provider: "text-cyan-600 dark:text-cyan-400",
};

export function GlobalSearch() {
  const router = useRouter();
  const { t } = useT();
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const [hits, setHits]     = useState<Hit[]>([]);
  const [loading, setLoad]  = useState(false);
  const [selected, setSel]  = useState(0);
  const inputRef            = useRef<HTMLInputElement>(null);
  const debounceRef         = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ───── Cmd/Ctrl+K to open ───── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ───── Focus + reset when open changes ───── */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setHits([]);
      setSel(0);
    }
  }, [open]);

  /* ───── Debounced search ───── */
  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    setLoad(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { hits: Hit[] };
      setHits(json.hits ?? []);
      setSel(0);
    } catch {
      setHits([]);
    } finally {
      setLoad(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  /* ───── Keyboard navigation in results ───── */
  function onListKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => (s + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => (s - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[selected];
      if (hit) {
        router.push(hit.href);
        setOpen(false);
      }
    }
  }

  /* ───── Group results by type ───── */
  const groups: Record<Hit["type"], Hit[]> = {
    resident: [], unit: [], contract: [], payment: [], ticket: [], provider: [],
  };
  hits.forEach((h) => groups[h.type].push(h));

  /* ───── UI ───── */
  return (
    <>
      {/* Trigger button — visible in topbar */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex h-9 items-center gap-2 rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition w-full sm:w-72"
        aria-label={t("search.aria_global")}
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-right">{t("search.trigger_label")}</span>
        <kbd className="hidden rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-xl border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input */}
            <div className="flex items-center gap-2 border-b px-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onListKey}
                placeholder={t("search.placeholder_input")}
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={t("search.aria_close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {!loading && query.trim().length >= 2 && hits.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("search.no_results", { query })}
                </p>
              )}

              {query.trim().length < 2 && (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  <p>{t("search.type_two_chars")}</p>
                  <p className="mt-2">{t("search.searches_in")}</p>
                  <p className="mt-3 text-[10px]">
                    💡 {t("search.keyboard_hint", {
                      up: "↑",
                      down: "↓",
                      enter: "Enter",
                    })}
                  </p>
                </div>
              )}

              {(Object.keys(groups) as Array<Hit["type"]>).map((type) => {
                const items = groups[type];
                if (items.length === 0) return null;
                const Icon = TYPE_ICONS[type];
                return (
                  <div key={type} className="mb-2">
                    <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t(TYPE_LABEL_KEYS[type] as TranslationKey)}
                    </p>
                    {items.map((hit) => {
                      const idx = hits.indexOf(hit);
                      const isSelected = idx === selected;
                      return (
                        <button
                          key={hit.id}
                          type="button"
                          onMouseEnter={() => setSel(idx)}
                          onClick={() => {
                            router.push(hit.href);
                            setOpen(false);
                          }}
                          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-right transition ${
                            isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                          }`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "" : TYPE_TONE[type]}`} />
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium">{hit.title}</p>
                            {hit.subtitle && (
                              <p className={`truncate text-xs ${isSelected ? "opacity-80" : "text-muted-foreground"}`}>
                                {hit.subtitle}
                              </p>
                            )}
                          </div>
                          <ArrowRight className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
