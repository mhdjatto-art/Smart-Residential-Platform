"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  automationRuleSchema, AUTOMATION_TRIGGERS, AUTOMATION_ACTIONS, AUTOMATION_STATUSES,
} from "@/lib/validations/automation";
import { createAutomationRule } from "@/lib/api/automation";

interface OrgOption { id: string; name: string; }
interface AutomationRuleFormProps { organizations: OrgOption[]; }

function safeJson(s: string): Record<string, unknown> {
  if (!s.trim()) return {};
  try { return JSON.parse(s); } catch { return { _invalid: true, raw: s }; }
}

export function AutomationRuleForm({ organizations }: AutomationRuleFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const triggerCfgRaw = String(fd.get("trigger_config") ?? "");
    const actionCfgRaw  = String(fd.get("action_config") ?? "");
    const triggerCfg = safeJson(triggerCfgRaw);
    const actionCfg  = safeJson(actionCfgRaw);
    if ((triggerCfg as { _invalid?: boolean })._invalid) {
      setErrors({ trigger_config: "Invalid JSON" }); return;
    }
    if ((actionCfg as { _invalid?: boolean })._invalid) {
      setErrors({ action_config: "Invalid JSON" }); return;
    }

    const candidate = {
      organization_id: String(fd.get("organization_id") ?? ""),
      compound_id: "",
      name: String(fd.get("name") ?? ""),
      description: String(fd.get("description") ?? ""),
      trigger_kind: String(fd.get("trigger_kind") ?? "cron"),
      trigger_config: triggerCfg,
      action: String(fd.get("action") ?? "send_notification"),
      action_config: actionCfg,
      status: String(fd.get("status") ?? "active"),
    };
    const parsed = automationRuleSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) next[k] = (v ?? [])[0]!;
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        await createAutomationRule(parsed.data);
        toast.success("Automation rule created");
        router.push("/automation");
        router.refresh();
      } catch (err) {
        toast.error("Save failed", { description: err instanceof Error ? err.message : "" });
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
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Name</Label>
            <Input name="name" required placeholder="e.g. Daily 9am: send reminders for installments due in 7 days" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Description</Label>
            <Textarea name="description" rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Trigger</Label>
            <Select name="trigger_kind" defaultValue="cron">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUTOMATION_TRIGGERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Action</Label>
            <Select name="action" defaultValue="send_notification">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUTOMATION_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Trigger config (JSON)</Label>
            <Textarea name="trigger_config" rows={4} placeholder={'{"cron":"0 9 * * *","days_ahead":7}'} />
            {errors.trigger_config && <p className="text-xs text-destructive">{errors.trigger_config}</p>}
          </div>
          <div className="space-y-2">
            <Label>Action config (JSON)</Label>
            <Textarea name="action_config" rows={4} placeholder={'{"channel":"in_app","template":"reminder_due_in_7"}'} />
            {errors.action_config && <p className="text-xs text-destructive">{errors.action_config}</p>}
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select name="status" defaultValue="active">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUTOMATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Create rule"}</Button>
      </div>
    </form>
  );
}
