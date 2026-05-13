import { Car, ParkingMeter, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { AssignSpotDialog, PlateBadge } from "@/components/parking/assign-spot-dialog";
import { requireUser } from "@/lib/auth/guards";
import { listEnrichedParking } from "@/lib/api/iot";
import { listResidentOptions } from "@/lib/api/residents";

export const dynamic = "force-dynamic";

const KIND_BADGE: Record<string, string> = {
  standard:    "bg-slate-100 text-slate-700",
  compact:     "bg-cyan-100 text-cyan-700",
  disabled:    "bg-violet-100 text-violet-700",
  ev:          "bg-emerald-100 text-emerald-700",
  visitor:     "bg-amber-100 text-amber-700",
  motorcycle:  "bg-orange-100 text-orange-700",
  other:       "bg-muted text-muted-foreground",
};

export default async function ParkingPage() {
  const user = await requireUser();
  const [spots, residents] = await Promise.all([
    listEnrichedParking(),
    listResidentOptions(),
  ]);

  const residentsForDialog = residents.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    unit_id: null as string | null,
  }));

  const occupied = spots.filter((s) => s.assignment_id).length;
  const vacant   = spots.length - occupied;
  const inactive = spots.filter((s) => !s.is_active).length;

  // Pick first org/compound from user — needed to insert assignments
  const orgId = user.organizationIds[0] ?? "";
  const compoundId = spots[0]?.compound_id ?? user.compoundIds[0] ?? "";

  return (
    <div>
      <PageHeader
        title="Parking"
        description="Visual grid of every spot. Click Assign to bind a resident's vehicle to a spot, or Manage to release."
        actions={null}
      />

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Total"    value={spots.length} tone="default" icon={ParkingMeter} />
        <Stat label="Occupied" value={occupied}    tone="emerald" icon={Car} />
        <Stat label="Vacant"   value={vacant}      tone="muted"   icon={PlusCircle} />
        <Stat label="Inactive" value={inactive}    tone="destructive" icon={ParkingMeter} />
      </div>

      {spots.length === 0 ? (
        <EmptyState
          icon={ParkingMeter}
          title="No parking spots yet"
          description="Add spots by inserting rows into parking_spots, or build a bulk-create form in a later step."
        />
      ) : (
        <>
          {/* Grid view (visual) */}
          <Card className="mb-6 p-4">
            <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Grid view</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-12">
              {spots.map((s) => {
                const occ = !!s.assignment_id;
                return (
                  <div key={s.spot_id}
                    className={`group relative aspect-square overflow-hidden rounded-md border p-1.5 text-center text-xs transition-colors ${
                      !s.is_active ? "bg-muted/40 opacity-50" :
                      occ ? "border-emerald-400/60 bg-emerald-50 dark:bg-emerald-950/30" :
                      "bg-card hover:bg-muted/50"
                    }`}
                    title={occ ? `${s.resident_name} · ${s.vehicle_plate ?? "no plate"}` : "Vacant"}
                  >
                    <p className="font-mono text-[11px] font-semibold">{s.spot_number}</p>
                    <span className={`mt-1 inline-block rounded px-1 text-[9px] ${KIND_BADGE[s.spot_kind] ?? KIND_BADGE.other}`}>
                      {s.spot_kind}
                    </span>
                    {occ && (
                      <Car className="absolute right-1 top-1 h-3 w-3 text-emerald-600" />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Detail table */}
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Spot</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Resident</th>
                  <th className="px-3 py-2 text-left">Vehicle</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {spots.map((s) => {
                  const occ = !!s.assignment_id;
                  return (
                    <tr key={s.spot_id} className="border-t">
                      <td className="px-3 py-2 font-mono font-semibold">{s.spot_number}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded px-2 py-0.5 text-[10px] ${KIND_BADGE[s.spot_kind] ?? KIND_BADGE.other}`}>
                          {s.spot_kind}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {!s.is_active ? (
                          <span className="text-xs text-muted-foreground">inactive</span>
                        ) : occ ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                            <Car className="h-3 w-3" /> occupied
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            vacant
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {s.resident_name ?? "—"}
                        {s.unit_number && <p className="text-[10px]">{s.unit_number}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <PlateBadge plate={s.vehicle_plate} />
                          {(s.vehicle_make || s.vehicle_model) && (
                            <span className="text-[11px] text-muted-foreground">
                              {[s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {s.is_active && (
                          <AssignSpotDialog
                            spotId={s.spot_id}
                            spotNumber={s.spot_number}
                            organizationId={orgId}
                            compoundId={compoundId}
                            residents={residentsForDialog}
                            currentAssignmentId={s.assignment_id}
                            currentResidentName={s.resident_name}
                            currentPlate={s.vehicle_plate}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone, icon: Icon }: {
  label: string; value: number; tone: "default" | "emerald" | "muted" | "destructive";
  icon: typeof Car;
}) {
  const styles = {
    default: "", emerald: "text-emerald-600 dark:text-emerald-400",
    muted: "text-muted-foreground", destructive: "text-destructive",
  } as const;
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-4 w-4 ${styles[tone]}`} />
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${styles[tone]}`}>{value}</p>
    </Card>
  );
}
