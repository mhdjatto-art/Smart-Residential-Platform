"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { technicianSchema, type TechnicianInput, TICKET_CATEGORIES } from "@/lib/validations/operations";
import { createTechnician } from "@/lib/api/technicians";

interface OrgOption { id: string; name: string; }

interface TechnicianFormProps {
  organizations: OrgOption[];
}

export function TechnicianForm({ organizations }: TechnicianFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Partial<Record<keyof TechnicianInput | "form" | "organization_id", string>>>({});
  const [specs, setSpecs] = useState<string[]>([]);

  function toggleSpec(spec: string) {
    setSpecs((cur) => cur.includes(spec) ? cur.filter((s) => s !== spec) : [...cur, spec]);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const orgId = String(fd.get("organization_id") ?? "");
    if (!orgId) {
      setErrors({ organization_id: "Required" });
      return;
    }
    const candidate = {
      full_name: String(fd.get("full_name") ?? ""),
      mobile: String(fd.get("mobile") ?? ""),
      email: String(fd.get("email") ?? ""),
      specialization: specs,
      availability_status: String(fd.get("availability_status") ?? "available"),
      is_active: fd.get("is_active") === "on",
      notes: String(fd.get("notes") ?? ""),
    };
    const parsed = technicianSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) next[k] = (v ?? [])[0]!;
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        await createTechnician(orgId, parsed.data);
        toast.success("Technician added");
        router.push("/technicians");
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
            <Label>Organization</Label>
            <Select name="organization_id" defaultValue={organizations[0]?.id} required>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {organizations.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.organization_id && <p className="text-xs text-destructive">{errors.organization_id}</p>}
          </div>

          <div className="space-y-2">
            <Label>Full name</Label>
            <Input name="full_name" required />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
          </div>
          <div className="space-y-2">
            <Label>Mobile</Label>
            <Input name="mobile" placeholder="+971…" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" name="email" />
          </div>
          <div className="space-y-2">
            <Label>Availability</Label>
            <Select name="availability_status" defaultValue="available">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
                <SelectItem value="off_duty">Off duty</SelectItem>
                <SelectItem value="vacation">Vacation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Specialization (tap to toggle)</Label>
            <div className="flex flex-wrap gap-2">
              {TICKET_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => toggleSpec(cat)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
                    specs.includes(cat) ? "bg-primary text-primary-foreground border-primary" : "border-input"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Notes</Label>
            <textarea name="notes" rows={2} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>

          <label className="md:col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" defaultChecked /> Active
          </label>
        </CardContent>
      </Card>

      {errors.form && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errors.form}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add technician"}</Button>
      </div>
    </form>
  );
}
