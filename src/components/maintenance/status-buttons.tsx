"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, Loader2, PauseCircle, PlayCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateJobStatus } from "@/lib/api/maintenance";

interface Props {
  jobId: string;
  currentStatus: string;
}

const TRANSITIONS: Record<string, Array<"in_progress" | "on_hold" | "completed" | "cancelled" | "scheduled">> = {
  scheduled:   ["in_progress", "cancelled"],
  in_progress: ["on_hold", "completed", "cancelled"],
  on_hold:     ["in_progress", "cancelled"],
  completed:   [],
  cancelled:   ["scheduled"],
};

const ICONS = {
  in_progress: PlayCircle,
  on_hold:     PauseCircle,
  completed:   CheckCircle,
  cancelled:   XCircle,
  scheduled:   PlayCircle,
};

const LABELS: Record<string, string> = {
  in_progress: "Start",
  on_hold:     "Pause",
  completed:   "Complete",
  cancelled:   "Cancel",
  scheduled:   "Reschedule",
};

export function StatusButtons({ jobId, currentStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [askingNotes, setAskingNotes] = useState(false);
  const [notes, setNotes] = useState("");

  const next = TRANSITIONS[currentStatus] ?? [];

  function go(status: typeof next[number]) {
    if (status === "completed") { setAskingNotes(true); return; }
    startTransition(async () => {
      try {
        await updateJobStatus(jobId, status);
        toast.success(`Status → ${status.replace("_", " ")}`);
        router.refresh();
      } catch (err) {
        toast.error("Update failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  function complete() {
    startTransition(async () => {
      try {
        await updateJobStatus(jobId, "completed", notes || undefined);
        toast.success("Job completed");
        setAskingNotes(false);
        setNotes("");
        router.refresh();
      } catch (err) {
        toast.error("Update failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  if (next.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {next.map((s) => {
          const Icon = ICONS[s];
          return (
            <Button key={s} size="sm" variant={s === "cancelled" ? "destructive" : s === "completed" ? "default" : "outline"}
              onClick={() => go(s)} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
              {LABELS[s]}
            </Button>
          );
        })}
      </div>

      {askingNotes && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <Textarea rows={3} placeholder="Completion notes (parts used, time spent, follow-up needed)…"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={complete} disabled={pending}>
              <CheckCircle className="h-4 w-4" /> Mark completed
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAskingNotes(false); setNotes(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
