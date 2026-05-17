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
import { createFacility } from "@/lib/api/facilities";
import type { FacilityInput } from "@/lib/validations/operations";

const FACILITY_TYPES = [
  "gym", "pool", "meeting_room", "event_hall", "football_field",
  "basketball_court", "tennis_court", "bbq_area", "playground", "other",
] as const;

interface Props {
  compounds: Array<{ id: string; name: string }>;
}

export function FacilityForm({ compounds }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FacilityInput>({
    compound_id: compounds[0]?.id ?? "",
    name: "",
    facility_type: "gym",
    capacity: undefined,
    booking_fee: 0,
    fee_currency: "USD",
    min_duration_minutes: 60,
    max_duration_minutes: 240,
    is_active: true,
    requires_approval: false,
    description: undefined,
  });

  function set<K extends keyof FacilityInput>(key: K, value: FacilityInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.compound_id || !form.name.trim()) {
      toast.error("Compound and name are required");
      return;
    }
    startTransition(async () => {
      try {
        await createFacility(form);
        toast.success("Facility created");
        router.push("/facilities");
        router.refresh();
      } catch (err) {
        toast.error("Save failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Facility details</CardTitle>
          <CardDescription>Pool, gym, hall, court — anything residents can book.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="compound">Compound</Label>
            <select id="compound"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.compound_id} onChange={(e) => set("compound_id", e.target.value)} required>
              {compounds.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <select id="type"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.facility_type} onChange={(e) => set("facility_type", e.target.value as FacilityInput["facility_type"])}>
              {FACILITY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Rooftop pool" required maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity (people, optional)</Label>
            <Input id="capacity" type="number" min={0} value={form.capacity ?? ""}
              onChange={(e) => set("capacity", e.target.value ? Number(e.target.value) : undefined)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fee">Booking fee</Label>
            <div className="flex gap-2">
              <Input id="fee" type="number" min={0} step="0.01" value={form.booking_fee}
                onChange={(e) => set("booking_fee", Number(e.target.value) || 0)} />
              <Input value={form.fee_currency} onChange={(e) => set("fee_currency", e.target.value.toUpperCase())}
                maxLength={3} className="w-20" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="min">Min duration (min)</Label>
            <Input id="min" type="number" min={15} max={1440} value={form.min_duration_minutes}
              onChange={(e) => set("min_duration_minutes", Number(e.target.value) || 60)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max">Max duration (min)</Label>
            <Input id="max" type="number" min={15} max={1440} value={form.max_duration_minutes}
              onChange={(e) => set("max_duration_minutes", Number(e.target.value) || 240)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value || undefined)}
              placeholder="Rules, hours, location notes…" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Booking policy</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)} />
            Facility is active and accepting bookings
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.requires_approval}
              onChange={(e) => set("requires_approval", e.target.checked)} />
            Require manager approval for each booking
          </label>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {pending ? "Creating…" : "Create facility"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
      </div>
    </form>
  );
}
