"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DoorOpen, Loader2, Lock, RotateCw, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { issueDeviceCommand } from "@/lib/api/iot";

interface DeviceActionsProps {
  deviceId: string;
  deviceKind: string;
  status: string;
}

/**
 * Renders the right control buttons for each device type.
 *
 *   gate_controller   → Open
 *   smart_lock        → Lock / Unlock
 *   parking_barrier   → Open
 *   router/switch/AP  → Restart
 *   anything          → Sync
 */
export function DeviceActions({ deviceId, deviceKind, status }: DeviceActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const offline = status === "offline" || status === "decommissioned";

  function send(command: string, label: string) {
    startTransition(async () => {
      try {
        await issueDeviceCommand(deviceId, command);
        toast.success(`${label} command queued`, { description: "Device will act when it picks up the queue." });
        router.refresh();
      } catch (err) {
        toast.error("Command failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  const buttons: Array<{ key: string; label: string; cmd: string; icon: typeof DoorOpen; tone?: "default" | "outline" | "destructive" }> = [];

  switch (deviceKind) {
    case "gate_controller":
    case "parking_barrier":
      buttons.push({ key: "open",    label: "Open",    cmd: "open",    icon: DoorOpen, tone: "default" });
      buttons.push({ key: "restart", label: "Restart", cmd: "restart", icon: RotateCw, tone: "outline" });
      break;
    case "smart_lock":
      buttons.push({ key: "unlock", label: "Unlock", cmd: "unlock", icon: Unlock, tone: "default" });
      buttons.push({ key: "lock",   label: "Lock",   cmd: "lock",   icon: Lock,   tone: "outline" });
      break;
    case "router":
    case "switch":
    case "access_point":
      buttons.push({ key: "restart", label: "Restart", cmd: "restart", icon: RotateCw, tone: "outline" });
      break;
    case "intercom":
      buttons.push({ key: "ring", label: "Ring", cmd: "ring", icon: RotateCw, tone: "outline" });
      break;
    default:
      buttons.push({ key: "sync", label: "Sync", cmd: "sync", icon: RotateCw, tone: "outline" });
  }

  return (
    <div className="flex flex-wrap gap-1">
      {buttons.map((b) => {
        const Icon = b.icon;
        return (
          <Button
            key={b.key}
            size="sm"
            variant={b.tone ?? "outline"}
            onClick={() => send(b.cmd, b.label)}
            disabled={pending || offline}
            title={offline ? "Device is offline" : b.label}
            className="h-8 px-2.5"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{b.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
