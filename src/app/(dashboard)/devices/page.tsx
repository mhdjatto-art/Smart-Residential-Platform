import { Cpu, ScrollText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { DeviceLiveRow } from "@/components/devices/device-live-row";
import { listDevices } from "@/lib/api/iot";

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  const devices = await listDevices();

  // Group by kind for visual chunking
  const byKind: Record<string, typeof devices> = {};
  for (const d of devices) (byKind[d.device_kind] ??= []).push(d);
  const kinds = Object.keys(byKind).sort();

  const stats = {
    total: devices.length,
    online: devices.filter((d) => d.status === "online").length,
    offline: devices.filter((d) => d.status === "offline").length,
    alerted: devices.filter((d) => d.status === "alerted" || d.status === "alert").length,
  };

  return (
    <div>
      <PageHeader
        title="Devices"
        titleKey="headers.devices_title"
        description="Real-time control panel for every IoT device. Open gates, lock doors, restart routers, and watch live events."
        descKey="headers.devices_desc"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/access-logs"><ScrollText className="h-4 w-4" />Access logs</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/access-zones"><ShieldCheck className="h-4 w-4" />Access zones</Link>
            </Button>
          </div>
        }
      />

      {/* Stats strip */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatBox label="Total"   value={stats.total}   />
        <StatBox label="Online"  value={stats.online}  tone="emerald" />
        <StatBox label="Offline" value={stats.offline} tone="muted" />
        <StatBox label="Alerted" value={stats.alerted} tone="destructive" />
      </div>

      {devices.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No devices yet"
          description="Provision your first device from /providers, or insert a row in `devices` directly."
        />
      ) : (
        <div className="space-y-6">
          {kinds.map((kind) => {
            const items = byKind[kind] ?? [];
            return (
              <Card key={kind} className="overflow-hidden">
                <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
                  <p className="text-sm font-medium capitalize">{kind.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">{items.length}</p>
                </div>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="hidden px-3 py-2 text-left sm:table-cell">Vendor</th>
                        <th className="hidden px-3 py-2 text-left md:table-cell">Address</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="hidden px-3 py-2 text-left lg:table-cell">Last seen</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((d) => <DeviceLiveRow key={d.id} device={d} />)}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "destructive" | "muted" }) {
  const styles: Record<NonNullable<typeof tone> | "default", string> = {
    default:     "",
    emerald:     "text-emerald-600 dark:text-emerald-400",
    destructive: "text-destructive",
    muted:       "text-muted-foreground",
  };
  const cls = styles[tone ?? "default"];
  return (
    <Card className="p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${cls}`}>{value}</p>
    </Card>
  );
}
