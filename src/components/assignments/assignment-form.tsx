"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assignmentSchema, type AssignmentInput } from "@/lib/validations/assignment";
import { createAssignment } from "@/lib/api/assignments";

interface ResidentOption { id: string; full_name: string; }

interface AssignmentFormProps {
  unitId: string;
  residents: ResidentOption[];
  onClose?: () => void;
}

type Errors = Partial<Record<keyof AssignmentInput | "form", string>>;

export function AssignmentForm({ unitId, residents, onClose }: AssignmentFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Errors>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const candidate = {
      unit_id: unitId,
      resident_id: String(fd.get("resident_id") ?? ""),
      assignment_type: String(fd.get("assignment_type") ?? "tenant") as AssignmentInput["assignment_type"],
      status: "active" as const,
      start_date: String(fd.get("start_date") ?? ""),
      end_date: String(fd.get("end_date") ?? ""),
      monthly_rent: String(fd.get("monthly_rent") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    };
    const parsed = assignmentSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Errors = {};
      for (const [k, v] of Object.entries(flat)) {
        next[k as keyof AssignmentInput] = (v ?? [])[0];
      }
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        await createAssignment(parsed.data);
        toast.success("Assignment created");
        onClose?.();
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setErrors({ form: msg });
        toast.error("Save failed", { description: msg });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Resident</Label>
          <Select name="resident_id" required>
            <SelectTrigger><SelectValue placeholder="Choose resident" /></SelectTrigger>
            <SelectContent>
              {residents.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.resident_id && <p className="text-xs text-destructive">{errors.resident_id}</p>}
        </div>

        <div className="space-y-2">
          <Label>Type</Label>
          <Select name="assignment_type" defaultValue="tenant">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="tenant">Tenant</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Monthly rent (for tenants)</Label>
          <Input type="number" step="0.01" name="monthly_rent" placeholder="0.00" />
          {errors.monthly_rent && <p className="text-xs text-destructive">{errors.monthly_rent}</p>}
        </div>

        <div className="space-y-2">
          <Label>Start date</Label>
          <Input type="date" name="start_date" required />
          {errors.start_date && <p className="text-xs text-destructive">{errors.start_date}</p>}
        </div>
        <div className="space-y-2">
          <Label>End date (optional)</Label>
          <Input type="date" name="end_date" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Notes</Label>
          <textarea
            name="notes"
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {errors.form && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errors.form}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onClose && (
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Assign resident"}
        </Button>
      </div>
    </form>
  );
}
