"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createBooking, type FacilityRow } from "@/lib/api/facilities";
import { formatCurrency } from "@/lib/utils";

interface Props {
  facilities: FacilityRow[];
  residents: Array<{ id: string; full_name: string }>;
}

export function BookingForm({ facilities, residents }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const todayLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const [facilityId, setFacilityId] = useState(facilities[0]?.id ?? "");
  const [residentId, setResidentId] = useState("");
  const [start, setStart] = useState(todayLocal);
  const [end, setEnd] = useState(todayLocal);
  const [notes, setNotes] = useState("");

  const selectedFacility = facilities.find((f) => f.id === facilityId);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!facilityId || !residentId) { toast.error("Facility and resident are required"); return; }
    if (new Date(end) <= new Date(start)) { toast.error("End time must be after start"); return; }
    startTransition(async () => {
      try {
        await createBooking({
          facility_id: facilityId,
          resident_id: residentId,
          start_time: new Date(start).toISOString(),
          end_time: new Date(end).toISOString(),
          notes: notes.trim() || undefined,
        });
        toast.success("Booking created");
        router.push("/bookings");
        router.refresh();
      } catch (err) {
        toast.error("Booking failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reservation</CardTitle>
          <CardDescription>Pick a facility, a resident, and the time slot.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="facility">Facility</Label>
            <select id="facility"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={facilityId} onChange={(e) => setFacilityId(e.target.value)} required>
              <option value="">— Select facility —</option>
              {facilities.filter((f) => f.is_active).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} · {f.facility_type.replace(/_/g, " ")}
                  {f.booking_fee > 0 ? ` · ${formatCurrency(f.booking_fee, { currency: f.fee_currency })}` : " · Free"}
                </option>
              ))}
            </select>
            {selectedFacility?.requires_approval && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ This facility requires manager approval before the booking is confirmed.
              </p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="resident">Resident</Label>
            <select id="resident"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={residentId} onChange={(e) => setResidentId(e.target.value)} required>
              <option value="">— Select resident —</option>
              {residents.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start">Start</Label>
            <Input id="start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end">End</Label>
            <Input id="end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Birthday party, 15 guests, etc." />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {pending ? "Creating…" : "Create booking"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
      </div>
    </form>
  );
}
