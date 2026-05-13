"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Search, X, XCircle, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import type { IntegrationRow } from "@/lib/api/pricing";

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

function relativeTime(iso: string | null): string {
  if (!iso) return "Never synced";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface IntegrationsBrowserProps {
  integrations: IntegrationRow[];
}

export function IntegrationsBrowser({ integrations }: IntegrationsBrowserProps) {
  const [search, setSearch] = useState("");
  const [adapter, setAdapter] = useState("");
  const [status, setStatus] = useState("");
  const [providerType, setProviderType] = useState("");

  const adapters     = useMemo(() => unique(integrations.map((i) => i.adapter_kind)), [integrations]);
  const statuses     = useMemo(() => unique(integrations.map((i) => i.status)), [integrations]);
  const types        = useMemo(() => unique(integrations.map((i) => i.provider_type ?? "")).filter(Boolean), [integrations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return integrations.filter((i) => {
      if (adapter && i.adapter_kind !== adapter) return false;
      if (status && i.status !== status) return false;
      if (providerType && i.provider_type !== providerType) return false;
      if (q) {
        const hay = (i.name + " " + (i.provider_name ?? "") + " " + (i.endpoint_url ?? "")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [integrations, search, adapter, status, providerType]);

  function clear() {
    setSearch(""); setAdapter(""); setStatus(""); setProviderType("");
  }
  const hasFilter = !!(search || adapter || status || providerType);

  // Health summary
  const summary = useMemo(() => ({
    total:        integrations.length,
    configured:   integrations.filter((i) => i.status === "configured").length,
    connected:    integrations.filter((i) => i.status === "connected").length,
    degraded:     integrations.filter((i) => i.status === "degraded").length,
    error:        integrations.filter((i) => i.status === "error").length,
    withErrors:   integrations.filter((i) => i.last_error).length,
  }), [integrations]);

  return (
    <div className="space-y-4">
      {/* Health summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <SummaryCard icon={Zap}          tone="default"     label="Total"      value={summary.total} />
        <SummaryCard icon={CheckCircle2} tone="emerald"     label="Connected"  value={summary.connected} />
        <SummaryCard icon={AlertCircle}  tone="amber"       label="Configured" value={summary.configured} />
        <SummaryCard icon={AlertCircle}  tone="amber"       label="Degraded"   value={summary.degraded} />
        <SummaryCard icon={XCircle}      tone="destructive" label="Error"      value={summary.error} />
        <SummaryCard icon={XCircle}      tone="destructive" label="Has errors" value={summary.withErrors} />
      </div>

      {/* Filter bar */}
      <Card className="p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search integration / provider / endpoint…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <FilterSelect label="All adapters"    value={adapter}      onChange={setAdapter}      options={adapters} />
          <FilterSelect label="All statuses"    value={status}       onChange={setStatus}       options={statuses} />
          <FilterSelect label="All types"       value={providerType} onChange={setProviderType} options={types} />
        </div>
        {hasFilter && (
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing <strong>{filtered.length}</strong> of {integrations.length}</span>
            <Button variant="ghost" size="sm" onClick={clear}><X className="h-3 w-3" /> Clear filters</Button>
          </div>
        )}
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Provider / Integration</TableHead>
              <TableHead>Adapter</TableHead>
              <TableHead className="hidden md:table-cell">Endpoint</TableHead>
              <TableHead>Last sync</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No integrations match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="text-xl">{flag(i.provider_country)}</TableCell>
                  <TableCell>
                    <p className="font-medium">{i.provider_name ?? i.name}</p>
                    <p className="text-[11px] text-muted-foreground">{i.name}</p>
                    {i.provider_category && (
                      <Badge variant="muted" className="mt-1 text-[10px]">{i.provider_category}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${ADAPTER_COLORS[i.adapter_kind] ?? "bg-muted text-muted-foreground"}`}>
                      {i.adapter_kind}
                    </span>
                    {i.provider_type && (
                      <p className="mt-1 text-[10px] capitalize text-muted-foreground">{i.provider_type}</p>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-xs truncate font-mono text-xs text-muted-foreground md:table-cell">
                    {i.endpoint_url ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {relativeTime(i.last_synced_at)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={i.status} />
                    {i.last_error && (
                      <p className="mt-1 max-w-xs truncate text-[10px] text-destructive" title={i.last_error}>
                        ⚠ {i.last_error}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon: Icon, tone, label, value,
}: {
  icon: typeof Zap;
  tone: "default" | "emerald" | "amber" | "destructive";
  label: string;
  value: number;
}) {
  const toneStyles: Record<typeof tone, string> = {
    default:     "text-foreground",
    emerald:     "text-emerald-600 dark:text-emerald-400",
    amber:       "text-amber-600 dark:text-amber-400",
    destructive: "text-destructive",
  };
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${toneStyles[tone]}`} />
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneStyles[tone]}`}>{value}</p>
    </Card>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— {label} —</option>
      {options.sort().map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
