"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { visitorSchema, type VisitorInput } from "@/lib/validations/operations";
import { createVisitor } from "@/lib/api/visitors";

interface ResidentOption { id: string; full_name: string; }

interface VisitorFormProps {
  residents: ResidentOption[];
}

export function VisitorForm({ residents }: VisitorFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Partial<Record<keyof VisitorInput | "form", string>>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const candidate = {
      resident_id: String(fd.get("resident_id") ?? ""),
      unit_id: "",
      full_name: String(fd.get("full_name") ?? ""),
      mobile: String(fd.get("mobile") ?? ""),
      id_number: String(fd.get("id_number") ?? ""),
      vehicle_plate: String(fd.get("vehicle_plate") ?? ""),
      visitor_type: String(fd.get("visitor_type") ?? "guest"),
      visit_purpose: String(fd.get("visit_purpose") ?? ""),
      scheduled_date: String(fd.get("scheduled_date") ?? ""),
      scheduled_time: String(fd.get("scheduled_time") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    };
    const parsed = visitorSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) next[k] = (v ?? [])[0]!;
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        const created = await createVisitor(parsed.data);
        toast.success("Visitor registered", { description: `Pass: ${created.pass_code}` });
        router.push(`/visitors/${created.id}`);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown";
        setErrors({ form: msg });
        toast.error("Save failed", { description: msg });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-2">
          <div className="md:col-span-2 space-y-2">
            <Label>Resident (host)</Label>
            <Select name="resident_id" required>
              <SelectTrigger><SelectValue placeholder="Choose resident hosting the visitor" /></SelectTrigger>
              <SelectContent>
                {residents.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.resident_id && <p className="text-xs text-destructive">{errors.resident_id}</p>}
          </div>

          <div className="space-y-2">
            <Label>Visitor full name</Label>
            <Input name="full_name" required />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select name="visitor_type" defaultValue="guest">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="guest">Guest</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Mobile</Label>
            <Input name="mobile" />
          </div>
          <div className="space-y-2">
            <Label>ID number</Label>
            <Input name="id_number" />
          </div>

          <div className="space-y-2">
            <Label>Vehicle plate</Label>
            <Input name="vehicle_plate" placeholder="e.g. DXB-A-12345" />
          </div>
          <div className="space-y-2">
            <Label>Visit purpose</Label>
            <Input name="visit_purpose" placeholder="optional" />
          </div>

          <div className="space-y-2">
            <Label>Scheduled date</Label>
            <Input type="date" name="scheduled_date" required />
            {errors.scheduled_date && <p className="text-xs text-destructive">{errors.scheduled_date}</p>}
          </div>
          <div className="space-y-2">
            <Label>Scheduled time</Label>
            <Input type="time" name="scheduled_time" />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Notes</Label>
            <textarea name="notes" rows={2} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </CardContent>
      </Card>

      {errors.form && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errors.form}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Register visitor"}</Button>
      </div>
    </form>
  );
}
