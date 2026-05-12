"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateTicket, addComment } from "@/lib/api/tickets";

export function StatusChanger({ ticketId, current }: { ticketId: string; current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(value: string) {
    if (value === current) return;
    startTransition(async () => {
      try {
        await updateTicket(ticketId, { status: value });
        toast.success(`Status → ${value}`);
        router.refresh();
      } catch (e) {
        toast.error("Failed", { description: e instanceof Error ? e.message : "" });
      }
    });
  }

  return (
    <Select value={current} onValueChange={change} disabled={pending}>
      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="open">Open</SelectItem>
        <SelectItem value="assigned">Assigned</SelectItem>
        <SelectItem value="in_progress">In progress</SelectItem>
        <SelectItem value="pending">Pending</SelectItem>
        <SelectItem value="resolved">Resolved</SelectItem>
        <SelectItem value="closed">Closed</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function CommentBox({ ticketId, isStaff }: { ticketId: string; isStaff: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      try {
        await addComment(ticketId, body, isInternal);
        setBody("");
        setIsInternal(false);
        toast.success("Comment added");
        router.refresh();
      } catch (e) {
        toast.error("Failed", { description: e instanceof Error ? e.message : "" });
      }
    });
  }

  return (
    <div className="space-y-3">
      <Input
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment…"
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
      />
      <div className="flex items-center justify-between">
        {isStaff ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
            Internal note (not visible to resident)
          </label>
        ) : <span />}
        <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
          {pending ? "Posting…" : "Post"}
        </Button>
      </div>
    </div>
  );
}
