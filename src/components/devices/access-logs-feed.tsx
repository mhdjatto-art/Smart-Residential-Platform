"use client";

import { useState } from "react";
import { CheckCircle2, ShieldAlert, ShieldX, Wifi, XCircle } from "lucide-react";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";

export interface AccessLog {
  id: string;
  zone_name: string | null;
  resident_name: string | null;
  access_method: string;
  outcome: string;
  occurred_at: string;
  plate: string | null;
}

const OUTCOME_STYLE: Record<string, { color: string; Icon: typeof CheckCircle2 }> = {
  granted:         { color: "text-emerald-600 dark:text-emerald-400", Icon: CheckCircle2 },
  denied:          { color: "text-rose-600 dark:text-rose-400",       Icon: XCircle },
  tailgate:        { color: "text-amber-600 dark:text-amber-400",     Icon: ShieldAlert },
  manual_override: { color: "text-violet-600 dark:text-violet-400",   Icon: ShieldAlert },
  expired:         { color: "text-muted-foreground",                  Icon: XCircle },
  blacklisted:     { color: "text-rose-700",                          Icon: ShieldX },
};

export function AccessLogsFeed({ initial }: { initial: AccessLog[] }) {
  const [logs, setLogs] = useState<AccessLog[]>(initial);

  useRealtimeChannel<{
    id: string;
    zone_id: string | null;
    resident_id: string | null;
    access_method: string;
    outcome: string;
    occurred_at: string;
    metadata: Record<string, unknown> | null;
  }>({
    table: "access_logs",
    onInsert: (row) => {
      const md = (row.metadata ?? {}) as Record<string, unknown>;
      const plate = typeof md.plate === "string" ? md.plate : null;
      setLogs((prev) => [
        {
          id: row.id,
          zone_name: typeof md.zone_name === "string" ? md.zone_name : null,
          resident_name: typeof md.resident_name === "string" ? md.resident_name : null,
          access_method: row.access_method,
          outcome: row.outcome,
          occurred_at: row.occurred_at,
          plate,
        },
        ...prev,
      ].slice(0, 200));
    },
  });

  if (logs.length === 0) {
    return (
      <div className="rounded-md border bg-card p-10 text-center">
        <Wifi className="mx-auto h-8 w-8 animate-pulse text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">
          Listening for access events… nothing yet.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Outcome</th>
            <th className="px-3 py-2 text-left">Zone</th>
            <th className="px-3 py-2 text-left">Resident / Plate</th>
            <th className="px-3 py-2 text-left">Method</th>
            <th className="px-3 py-2 text-right">When</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => {
            const sty = OUTCOME_STYLE[l.outcome] ?? OUTCOME_STYLE.denied;
            const Icon = sty.Icon;
            return (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center gap-1 text-sm font-medium ${sty.color}`}>
                    <Icon className="h-4 w-4" />
                    <span className="capitalize">{l.outcome.replace(/_/g, " ")}</span>
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{l.zone_name ?? "—"}</td>
                <td className="px-3 py-2">{l.resident_name ?? l.plate ?? "—"}</td>
                <td className="px-3 py-2 text-xs uppercase text-muted-foreground">{l.access_method}</td>
                <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                  {new Date(l.occurred_at).toLocaleTimeString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
