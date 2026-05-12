"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createFloor, deleteFloor } from "@/lib/api/floors";

interface Floor {
  id: string;
  floor_number: number;
  floor_name: string | null;
  total_units: number;
}

interface FloorListProps {
  buildingId: string;
  floors: Floor[];
}

export function FloorList({ buildingId, floors }: FloorListProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    const num = Number(number);
    if (!Number.isInteger(num)) {
      toast.error("Floor number must be an integer");
      return;
    }
    startTransition(async () => {
      try {
        await createFloor({ building_id: buildingId, floor_number: num, floor_name: name || undefined });
        toast.success("Floor added");
        setNumber(""); setName(""); setAdding(false);
        router.refresh();
      } catch (e) {
        toast.error("Could not add floor", { description: e instanceof Error ? e.message : "" });
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this floor? Units on it will lose their floor reference.")) return;
    startTransition(async () => {
      try {
        await deleteFloor(id);
        toast.success("Floor deleted");
        router.refresh();
      } catch (e) {
        toast.error("Could not delete", { description: e instanceof Error ? e.message : "" });
      }
    });
  }

  return (
    <div className="space-y-3">
      {floors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No floors defined yet.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {floors.map((f) => (
            <li key={f.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <p className="font-medium">
                  {f.floor_name ? `${f.floor_name} ` : ""}Floor {f.floor_number}
                </p>
                <p className="text-xs text-muted-foreground">{f.total_units} units</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(f.id)} disabled={pending}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="w-24"
          />
          <Input
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Button onClick={add} disabled={pending}>Save</Button>
          <Button variant="outline" onClick={() => setAdding(false)} disabled={pending}>Cancel</Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add floor
        </Button>
      )}
    </div>
  );
}
