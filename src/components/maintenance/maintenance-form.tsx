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
import { createMaintenanceJob } from "@/lib/api/maintenance";
import type { MaintenanceJobInput } from "@/lib/validations/operations";
import type { UnitOption } from "@/lib/api/units";

interface MaintenanceFormProps {
  compounds: Array<{ id: string; name: string }>;
  units: UnitOption[];
}

const JOB_TYPES = ["preventive", "corrective", "emergency"] as const;

export function MaintenanceForm({ compounds, units }: MaintenanceFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<MaintenanceJobInput>({
    compound_id: compounds[0]?.id ?? "",
    unit_id: undefined,
    building_id: undefined,
    ticket_id: undefined,
    job_type: "corrective",
    title: "",
    description: undefined,
    assigned_technician_id: undefined,
    scheduled_for: new Date().toISOString().slice(0, 16),
    cost: undefined,
  });

  function set<K extends keyof MaintenanceJobInput>(key: K, value: MaintenanceJobInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const filteredUnits = units.filter((u) => !form.compound_id || u.compound_id === form.compound_id);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.compound_id || !form.title.trim()) {
      toast.error("Compound and title are required");
      return;
    }
    startTransition(async () => {
      try {
        await createMaintenanceJob(form);
        toast.success("Job created");
        router.push("/maintenance");
        router.refresh();
      } catch (err) {
        toast.error("Save failed", { description: err instanceof Error ? err.message : "Unknown error" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Job details</CardTitle>
          <CardDescription>Create a work order. Assign a technician now or later.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="compound">Compound</Label>
            <select id="compound"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.compound_id} onChange={(e) => { set("compound_id", e.target.value); set("unit_id", undefined); }}
              required
            >
              {compounds.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="job_type">Type</Label>
            <select id="job_type"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.job_type} onChange={(e) => set("job_type", e.target.value as MaintenanceJobInput["job_type"])}
            >
              {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Replace bathroom faucet in A-101" required maxLength={160} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value || undefined)}
              placeholder="What needs to be done, parts required, access notes…" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit_id">Unit (optional)</Label>
            <select id="unit_id"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.unit_id ?? ""} onChange={(e) => set("unit_id", e.target.value || undefined)}
            >
              <option value="">— Compound-level —</option>
              {filteredUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.building_name ? `${u.building_name} · ` : ""}{u.unit_number}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduled_for">Scheduled for</Label>
            <Input id="scheduled_for" type="datetime-local"
              value={form.scheduled_for ?? ""}
              onChange={(e) => set("scheduled_for", e.target.value || undefined)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost">Estimated cost (optional)</Label>
            <Input id="cost" type="number" min={0} step="0.01"
              value={form.cost ?? ""}
              onChange={(e) => set("cost", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="0.00" />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {pending ? "Creating…" : "Create job"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
