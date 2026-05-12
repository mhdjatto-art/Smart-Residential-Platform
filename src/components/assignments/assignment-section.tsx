"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { AssignmentForm } from "./assignment-form";
import { endAssignment } from "@/lib/api/assignments";
import { formatDate } from "@/lib/utils";

interface Assignment {
  id: string;
  resident_id: string;
  assignment_type: string;
  status: string;
  start_date: string;
  end_date: string | null;
  monthly_rent: number | null;
}

interface ResidentOption { id: string; full_name: string; }

interface AssignmentSectionProps {
  unitId: string;
  assignments: Assignment[];
  residents: ResidentOption[];
  residentNames: Record<string, string>;
}

export function AssignmentSection({ unitId, assignments, residents, residentNames }: AssignmentSectionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function endNow(id: string) {
    if (!confirm("End this assignment today? This is recorded — it can't be deleted.")) return;
    const today = new Date().toISOString().slice(0, 10);
    startTransition(async () => {
      try {
        await endAssignment(id, today);
        toast.success("Assignment ended");
        router.refresh();
      } catch (e) {
        toast.error("Could not end", { description: e instanceof Error ? e.message : "" });
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Assignments</CardTitle>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" /> {open ? "Close" : "Assign resident"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {open && (
          <AssignmentForm unitId={unitId} residents={residents} onClose={() => setOpen(false)} />
        )}

        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assignments yet — this unit is unoccupied.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resident</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead className="text-right">Rent</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{residentNames[a.resident_id] ?? a.resident_id.slice(0, 8)}</TableCell>
                  <TableCell className="capitalize">{a.assignment_type}</TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(a.start_date)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(a.end_date)}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.monthly_rent ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {a.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => endNow(a.id)} disabled={pending}>
                        End
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
