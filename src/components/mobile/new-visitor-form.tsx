"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { visitorSchema } from "@/lib/validations/operations";
import { createVisitor } from "@/lib/api/visitors";

interface NewVisitorFormProps {
  residentId: string;
  unitId: string | null;
}

export function NewVisitorForm({ residentId, unitId }: NewVisitorFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const candidate = {
      resident_id: residentId,
      unit_id: unitId ?? "",
      full_name: String(fd.get("full_name") ?? ""),
      mobile: String(fd.get("mobile") ?? ""),
      id_number: String(fd.get("id_number") ?? ""),
      vehicle_plate: String(fd.get("vehicle_plate") ?? ""),
      visitor_type: String(fd.get("visitor_type") ?? "guest"),
      visit_purpose: String(fd.get("visit_purpose") ?? ""),
      scheduled_date: String(fd.get("scheduled_date") ?? ""),
      scheduled_time: String(fd.get("scheduled_time") ?? ""),
      notes: "",
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
        await createVisitor(parsed.data);
        toast.success("Visitor pre-registered");
        router.push("/m/visitors");
        router.refresh();
      } catch (err) {
        toast.error("Failed", { description: err instanceof Error ? err.message : "" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardContent className="grid gap-4 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Visitor name</Label>
            <Input name="full_name" required placeholder="Full name" />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input name="scheduled_date" type="date" required />
              {errors.scheduled_date && <p className="text-xs text-destructive">{errors.scheduled_date}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Time</Label>
              <Input name="scheduled_time" type="time" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
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
          <div className="space-y-1.5">
            <Label className="text-xs">Mobile</Label>
            <Input name="mobile" type="tel" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">ID number</Label>
              <Input name="id_number" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vehicle plate</Label>
              <Input name="vehicle_plate" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Purpose</Label>
            <Textarea name="visit_purpose" rows={2} />
          </div>
        </CardContent>
      </Card>
      <Button type="submit" className="mt-4 w-full" disabled={pending}>{pending ? "Saving…" : "Pre-register"}</Button>
    </form>
  );
}
