"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calculator, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordReading, generateElectricityBillFromReading } from "@/lib/api/utilities";

interface ReadingFormProps {
  meterId: string;
  currentReading: number;
}

export function ReadingForm({ meterId, currentReading }: ReadingFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const reading_value = Number(fd.get("reading_value"));
    const reading_date = String(fd.get("reading_date"));
    const source = String(fd.get("source") ?? "manual");
    const notes = String(fd.get("notes") ?? "");

    if (reading_value < currentReading) {
      toast.error(`New reading must be ≥ current (${currentReading})`);
      return;
    }

    startTransition(async () => {
      try {
        const created = await recordReading({
          meter_id: meterId,
          reading_date,
          reading_value,
          source: source as "manual" | "photo" | "smart_meter" | "imported",
          notes: notes || undefined,
        });
        toast.success(`Reading recorded (${created.consumption} consumed)`);
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error("Save failed", { description: err instanceof Error ? err.message : "" });
      }
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New reading
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-md border bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Reading date</Label>
          <Input type="date" name="reading_date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </div>
        <div className="space-y-1">
          <Label>Reading value (current: {currentReading})</Label>
          <Input type="number" step="0.01" name="reading_value" required min={currentReading} />
        </div>
        <div className="space-y-1">
          <Label>Source</Label>
          <Select name="source" defaultValue="manual">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="photo">Photo</SelectItem>
              <SelectItem value="smart_meter">Smart meter</SelectItem>
              <SelectItem value="imported">Imported</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Notes</Label>
          <Input name="notes" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Record reading"}</Button>
      </div>
    </form>
  );
}

interface GenerateBillButtonProps {
  readingId: string;
  disabled?: boolean;
}

export function GenerateBillButton({ readingId, disabled }: GenerateBillButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        await generateElectricityBillFromReading(readingId);
        toast.success("Electricity bill generated");
        router.refresh();
      } catch (err) {
        toast.error("Could not generate", { description: err instanceof Error ? err.message : "" });
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={disabled || pending}>
      <Calculator className="h-4 w-4" /> Generate bill
    </Button>
  );
}
