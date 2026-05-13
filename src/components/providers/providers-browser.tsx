"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ProviderRow } from "@/lib/api/utilities";

// Two-letter country code → flag emoji
function flag(code?: string | null): string {
  if (!code || code.length !== 2) return "🌐";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + code.toUpperCase().charCodeAt(0) - 65, A + code.toUpperCase().charCodeAt(1) - 65);
}

const ADAPTER_COLORS: Record<string, string> = {
  modbus:   "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
  mikrotik: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  unifi:    "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  radius:   "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  mqtt:     "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300",
  rest:     "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  webhook:  "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  generic:  "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
};

interface ProvidersBrowserProps {
  providers: ProviderRow[];
}

export function ProvidersBrowser({ providers }: ProvidersBrowserProps) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("");
  const [adapter, setAdapter] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [category, setCategory] = useState<string>("");

  // Derive option lists from the actual data
  const types     = useMemo(() => unique(providers.map((p) => p.provider_type)), [providers]);
  const adapters  = useMemo(() => unique(providers.map((p) => p.adapter_kind ?? "")).filter(Boolean), [providers]);
  const countries = useMemo(() => unique(providers.map((p) => meta(p, "country"))).filter(Boolean), [providers]);
  const categories= useMemo(() => unique(providers.map((p) => meta(p, "category"))).filter(Boolean), [providers]);

  // Apply filters
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return providers.filter((p) => {
      if (type && p.provider_type !== type) return false;
      if (adapter && p.adapter_kind !== adapter) return false;
      if (country && meta(p, "country") !== country) return false;
      if (category && meta(p, "category") !== category) return false;
      if (q) {
        const haystack = (
          p.provider_name + " " +
          (p.provider_code ?? "") + " " +
          (meta(p, "name_ar") ?? "")
        ).toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [providers, search, type, adapter, country, category]);

  function clear() {
    setSearch(""); setType(""); setAdapter(""); setCountry(""); setCategory("");
  }

  const hasFilter = !!(search || type || adapter || country || category);

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Total" value={providers.length} />
        <StatCard label="Electricity" value={providers.filter((p) => p.provider_type === "electricity").length} />
        <StatCard label="Internet" value={providers.filter((p) => p.provider_type === "internet").length} />
        <StatCard label="Physical infra" value={providers.filter((p) => meta(p, "category")).length} />
      </div>

      {/* Filter bar */}
      <Card className="p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name / code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <FilterSelect label="All types" value={type} onChange={setType} options={types} />
          <FilterSelect label="All adapters" value={adapter} onChange={setAdapter} options={adapters} />
          <FilterSelect label="All countries" value={country} onChange={setCountry} options={countries}
            formatLabel={(c) => `${flag(c)} ${c}`} />
          <FilterSelect label="All categories" value={category} onChange={setCategory} options={categories} />
        </div>
        {hasFilter && (
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing <strong>{filtered.length}</strong> of {providers.length}</span>
            <Button variant="ghost" size="sm" onClick={clear}>
              <X className="h-3 w-3" /> Clear filters
            </Button>
          </div>
        )}
      </Card>

      {/* Results table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Adapter</TableHead>
              <TableHead className="hidden md:table-cell">Code</TableHead>
              <TableHead className="hidden lg:table-cell">Billing</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No providers match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => {
                const c = meta(p, "country");
                const cat = meta(p, "category");
                const nameAr = meta(p, "name_ar");
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-xl">{flag(c)}</TableCell>
                    <TableCell>
                      <p className="font-medium">{p.provider_name}</p>
                      {nameAr && <p className="text-[11px] text-muted-foreground">{nameAr}</p>}
                      {cat && <Badge variant="muted" className="mt-1 text-[10px]">{cat}</Badge>}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">{p.provider_type}</TableCell>
                    <TableCell>
                      {p.adapter_kind ? (
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${ADAPTER_COLORS[p.adapter_kind] ?? "bg-muted text-muted-foreground"}`}>
                          {p.adapter_kind}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                      {p.provider_code ?? "—"}
                    </TableCell>
                    <TableCell className="hidden capitalize text-muted-foreground lg:table-cell">
                      {p.billing_method.replace("_", " ")}
                    </TableCell>
                    <TableCell><StatusBadge status={p.provider_status} /></TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </Card>
  );
}

function FilterSelect({
  label, value, onChange, options, formatLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  formatLabel?: (v: string) => string;
}) {
  return (
    <select
      className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— {label} —</option>
      {options.sort().map((o) => (
        <option key={o} value={o}>{formatLabel ? formatLabel(o) : o}</option>
      ))}
    </select>
  );
}

// Helpers
function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
function meta(p: ProviderRow, key: string): string {
  const m = (p.metadata ?? {}) as Record<string, unknown>;
  const v = m[key];
  return typeof v === "string" ? v : "";
}
