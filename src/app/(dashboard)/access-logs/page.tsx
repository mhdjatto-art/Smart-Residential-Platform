import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AccessLogsFeed, type AccessLog } from "@/components/devices/access-logs-feed";
import { requireUser, requireCapability } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Access logs" };
export const dynamic = "force-dynamic";

export default async function AccessLogsPage() {
  await requireCapability("access:read");
  await requireUser();
  const supabase = await createClient();

  // Pull last 100 with joined zone + resident name
  const { data } = await supabase
    .from("access_logs")
    .select(`
      id, zone_id, resident_id, access_method, outcome, occurred_at,
      zone:access_zones(name),
      resident:residents(first_name, last_name)
    `)
    .order("occurred_at", { ascending: false })
    .limit(100);

  type Raw = {
    id: string; zone_id: string | null; resident_id: string | null;
    access_method: string; outcome: string; occurred_at: string;
    zone: { name: string | null } | null;
    resident: { first_name: string | null; last_name: string | null } | null;
  };
  const initial: AccessLog[] = ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    zone_name: r.zone?.name ?? null,
    resident_name: r.resident
      ? [r.resident.first_name, r.resident.last_name].filter(Boolean).join(" ") || null
      : null,
    access_method: r.access_method,
    outcome: r.outcome,
    occurred_at: r.occurred_at,
    plate: null,
  }));

  return (
    <div>
      <PageHeader
        title="Access logs"
        description="Live feed of every gate / door / barrier event across the compound. New events appear instantly via Supabase Realtime."
        actions={
          <div className="inline-flex items-center gap-1.5 rounded-full border bg-emerald-50 px-3 py-1 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            <Activity className="h-3 w-3 animate-pulse" /> Live
          </div>
        }
      />
      <AccessLogsFeed initial={initial} />
    </div>
  );
}
