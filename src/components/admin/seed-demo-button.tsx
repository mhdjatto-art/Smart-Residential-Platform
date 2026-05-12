"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SummaryCredential {
  email: string;
  password: string;
  role: string;
  unit?: string | null;
}

interface SeedSummary {
  org_id: string;
  compound_id: string;
  buildings: number;
  units: number;
  users: number;
  residents: number;
  contracts: number;
  payments: number;
  utility_bills: number;
  tickets: number;
  notifications: number;
  credentials: SummaryCredential[];
  warnings: string[];
}

export function SeedDemoButton() {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [summary, setSummary] = useState<SeedSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  function runSeed() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/seed-demo", { method: "POST" });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          const msg = json.error ?? `HTTP ${res.status}`;
          setError(msg);
          toast.error("Seed failed", { description: msg });
          return;
        }
        setSummary(json.summary as SeedSummary);
        toast.success("Demo data seeded", {
          description: `${json.summary.users} users · ${json.summary.residents} residents · ${json.summary.contracts} contracts`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        setError(msg);
        toast.error("Seed failed", { description: msg });
      } finally {
        setConfirming(false);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" /> Destructive action
        </div>
        <p className="text-sm text-muted-foreground">
          This will <strong>delete every <code>@bonyan.demo</code> auth user</strong> and the entire
          <strong> &ldquo;Bonyan Demo Group&rdquo;</strong> organization (with all its buildings, units,
          residents, contracts, payments, bills, tickets, and notifications), then recreate them from
          scratch. Real production data is not touched.
        </p>
      </div>

      {!confirming ? (
        <Button onClick={() => setConfirming(true)} disabled={pending} size="lg">
          <Database className="h-4 w-4" />
          Reset &amp; seed demo data
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Are you sure?</span>
          <Button onClick={runSeed} disabled={pending} variant="destructive" size="lg">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? "Wiping & seeding…" : "Yes, wipe and seed"}
          </Button>
          <Button onClick={() => setConfirming(false)} disabled={pending} variant="outline">
            Cancel
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {summary && (
        <div className="space-y-4 rounded-md border bg-muted/30 p-4">
          <div>
            <h3 className="text-base font-semibold">Seed complete</h3>
            <p className="text-sm text-muted-foreground">
              {summary.users} auth users · {summary.residents} residents · {summary.buildings} buildings ·{" "}
              {summary.units} units · {summary.contracts} contracts · {summary.payments} payments ·{" "}
              {summary.utility_bills} utility bills · {summary.tickets} tickets · {summary.notifications}{" "}
              notifications.
            </p>
          </div>

          <div className="overflow-hidden rounded-md border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Unit</th>
                  <th className="px-3 py-2 text-left">Password</th>
                </tr>
              </thead>
              <tbody>
                {summary.credentials.map((c) => (
                  <tr key={c.email} className="border-t">
                    <td className="px-3 py-2 font-mono">{c.email}</td>
                    <td className="px-3 py-2">{c.role}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.unit ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">{c.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {summary.warnings.length > 0 && (
            <details className="rounded-md border border-amber-400/40 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
              <summary className="cursor-pointer font-medium text-amber-700 dark:text-amber-300">
                {summary.warnings.length} non-fatal warning{summary.warnings.length === 1 ? "" : "s"} (click to view)
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800 dark:text-amber-200">
                {summary.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
