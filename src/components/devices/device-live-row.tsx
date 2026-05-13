"use client";

import { useState } from "react";
import { Activity } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { DeviceActions } from "@/components/devices/device-actions";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import type { DeviceRow } from "@/lib/api/iot";

interface DeviceLiveRowProps {
  device: DeviceRow;
}

/**
 * Realtime-aware row: subscribes to device_events for this device and
 * shows a pulsing dot for ~3s whenever a new event lands.
 */
export function DeviceLiveRow({ device }: DeviceLiveRowProps) {
  const [pulse, setPulse] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  useRealtimeChannel<{ id: number; event_kind: string; occurred_at: string }>({
    table: "device_events",
    filter: `device_id=eq.${device.id}`,
    onInsert: (row) => {
      setLastEvent(`${row.event_kind} · ${new Date(row.occurred_at).toLocaleTimeString()}`);
      setPulse(true);
      setTimeout(() => setPulse(false), 3000);
    },
  });

  return (
    <tr className="border-t">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {pulse && <Activity className="h-3.5 w-3.5 animate-pulse text-emerald-500" />}
          <div>
            <p className="font-medium">{device.name}</p>
            <p className="text-[11px] text-muted-foreground">{device.device_kind}</p>
          </div>
        </div>
      </td>
      <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">
        {device.vendor ?? "—"}
        {device.model && <> · {device.model}</>}
      </td>
      <td className="hidden px-3 py-2 font-mono text-xs text-muted-foreground md:table-cell">
        {device.ip_address ?? device.serial ?? "—"}
      </td>
      <td className="px-3 py-2">
        <StatusBadge status={device.status} />
        {lastEvent && (
          <p className="mt-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
            {lastEvent}
          </p>
        )}
      </td>
      <td className="hidden px-3 py-2 text-xs text-muted-foreground lg:table-cell">
        {device.last_seen_at ? timeAgo(device.last_seen_at) : "never"}
      </td>
      <td className="px-3 py-2 text-right">
        <DeviceActions deviceId={device.id} deviceKind={device.device_kind} status={device.status} />
      </td>
    </tr>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}
