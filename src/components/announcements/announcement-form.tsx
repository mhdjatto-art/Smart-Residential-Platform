"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { announcementSchema, type AnnouncementInput } from "@/lib/validations/operations";
import { createAnnouncement } from "@/lib/api/announcements";

interface OrgOption { id: string; name: string; }
interface CompoundOption { id: string; name: string; }

interface AnnouncementFormProps {
  organizations: OrgOption[];
  compounds: CompoundOption[];
}

export function AnnouncementForm({ organizations, compounds }: AnnouncementFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Partial<Record<keyof AnnouncementInput | "form" | "organization_id", string>>>({});

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
      compound_id: String(fd.get("compound_id") ?? "").replace("__none__", ""),
      kind: String(fd.get("kind") ?? "general"),
      title: String(fd.get("title") ?? ""),
      body: String(fd.get("body") ?? ""),
      target_audience: String(fd.get("target_audience") ?? "all"),
      expires_at: String(fd.get("expires_at") ?? ""),
      is_pinned: fd.get("is_pinned") === "on",
    };
    const parsed = announcementSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) next[k] = (v ?? [])[0]!;
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        await createAnnouncement(orgId, parsed.data);
        toast.success("Announcement published");
        router.push("/announcements");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown";
        setErrors({ form: msg });
        toast.error("Failed", { description: msg });
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
            <Label>Compound (optional)</Label>
            <Select name="compound_id" defaultValue="__none__">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— All compounds —</SelectItem>
                {compounds.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Kind</Label>
            <Select name="kind" defaultValue="general">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="security">Security</SelectItem>
                <SelectItem value="event">Event</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Audience</Label>
            <Select name="target_audience" defaultValue="all">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="staff_only">Staff only</SelectItem>
                <SelectItem value="residents_only">Residents only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Expires at (optional)</Label>
            <Input type="datetime-local" name="expires_at" />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Title</Label>
            <Input name="title" required maxLength={200} />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Body</Label>
            <textarea
              name="body" required rows={6}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {errors.body && <p className="text-xs text-destructive">{errors.body}</p>}
          </div>

          <label className="md:col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_pinned" /> Pin to top
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
        <Button type="submit" disabled={pending}>{pending ? "Publishing…" : "Publish"}</Button>
      </div>
    </form>
  );
}
