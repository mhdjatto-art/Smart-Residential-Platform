"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Car, Loader2, UserPlus, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createParkingAssignment, releaseParkingAssignment } from "@/lib/api/iot";

interface Resident { id: string; full_name: string; unit_id: string | null }

interface AssignSpotDialogProps {
  spotId: string;
  spotNumber: string;
  organizationId: string;
  compoundId: string;
  residents: Resident[];
  currentAssignmentId?: string | null;
  currentResidentName?: string | null;
  currentPlate?: string | null;
}

export function AssignSpotDialog({
  spotId, spotNumber, organizationId, compoundId, residents,
  currentAssignmentId, currentResidentName, currentPlate,
}: AssignSpotDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [residentId, setResidentId] = useState("");
  const [plate, setPlate] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return residents.slice(0, 30);
    return residents.filter((r) => r.full_name.toLowerCase().includes(q)).slice(0, 30);
  }, [residents, search]);

  function assign() {
    if (!residentId) { toast.error("Select a resident"); return; }
    startTransition(async () => {
      try {
        const res = residents.find((r) => r.id === residentId);
        await createParkingAssignment({
          organization_id: organizationId,
          compound_id: compoundId,
          spot_id: spotId,
          resident_id: residentId,
          unit_id: res?.unit_id ?? undefined,
          vehicle_plate: plate.trim() || undefined,
          vehicle_make: make.trim() || undefined,
          vehicle_model: model.trim() || undefined,
          start_date: new Date().toISOString().slice(0, 10),
          status: "active",
        });
        toast.success(`Spot ${spotNumber} assigned`);
        setOpen(false);
        setResidentId(""); setPlate(""); setMake(""); setModel("");
        router.refresh();
      } catch (err) {
        toast.error("Assign failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  function release() {
    if (!currentAssignmentId) return;
    if (!confirm(`Release spot ${spotNumber} from ${currentResidentName ?? "current holder"}?`)) return;
    startTransition(async () => {
      try {
        await releaseParkingAssignment(currentAssignmentId);
        toast.success(`Spot ${spotNumber} released`);
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error("Release failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={currentAssignmentId ? "outline" : "default"} className="h-7 px-2 text-xs">
          {currentAssignmentId ? "Manage" : "Assign"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Parking spot {spotNumber}</DialogTitle>
          <DialogDescription>
            {currentAssignmentId
              ? `Currently assigned to ${currentResidentName ?? "unknown"}${currentPlate ? ` · ${currentPlate}` : ""}`
              : "Assign this spot to a resident."}
          </DialogDescription>
        </DialogHeader>

        {currentAssignmentId ? (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p><strong>Resident:</strong> {currentResidentName ?? "—"}</p>
              {currentPlate && <p><strong>Plate:</strong> <span className="font-mono">{currentPlate}</span></p>}
            </div>
            <Button variant="destructive" onClick={release} disabled={pending} className="w-full">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              <X className="h-4 w-4" /> Release spot
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="search">Search resident</Label>
              <Input id="search" placeholder="Type to filter…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select
                className="flex h-10 w-full rounded-md border bg-background px-2 text-sm"
                value={residentId} onChange={(e) => setResidentId(e.target.value)} size={Math.min(6, filtered.length + 1)}
              >
                <option value="">— Select resident —</option>
                {filtered.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="plate">Plate (optional)</Label>
                <Input id="plate" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder="ABC-1234" className="font-mono" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="make">Make</Label>
                <Input id="make" value={make} onChange={(e) => setMake(e.target.value)} placeholder="Toyota" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label htmlFor="model">Model</Label>
                <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Corolla 2020" />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Close</Button>
          {!currentAssignmentId && (
            <Button onClick={assign} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {pending ? "Assigning…" : `Assign spot ${spotNumber}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PlateBadge({ plate }: { plate: string | null }) {
  if (!plate) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded border bg-yellow-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-yellow-900">
      <Car className="h-3 w-3" /> {plate}
    </span>
  );
}
