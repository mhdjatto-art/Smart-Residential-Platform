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
import { integrationSchema, ADAPTER_KINDS } from "@/lib/validations/pricing";
import { createIntegration } from "@/lib/api/pricing";

interface OrgOption { id: string; name: string; }
interface IntegrationFormProps { organizations: OrgOption[]; }

function safeJson(s: string): Record<string, unknown> {
  if (!s.trim()) return {};
  try { return JSON.parse(s); } catch { return { __invalid: true }; }
}

export function IntegrationForm({ organizations }: IntegrationFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const configRaw = String(fd.get("config") ?? "{}");
    const config = safeJson(configRaw);
    if ((config as { __invalid?: boolean }).__invalid) {
      setErrors({ config: "Invalid JSON" }); return;
    }
    const candidate = {
      organization_id: String(fd.get("organization_id") ?? ""),
      provider_id: "",
      adapter_kind: String(fd.get("adapter_kind") ?? "rest"),
      name: String(fd.get("name") ?? ""),
      endpoint_url: String(fd.get("endpoint_url") ?? ""),
      config,
      status: String(fd.get("status") ?? "configured"),
      is_active: true,
      health_check_url: String(fd.get("health_check_url") ?? ""),
    };
    const parsed = integrationSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) next[k] = (v ?? [])[0]!;
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        await createIntegration(parsed.data);
        toast.success("Integration created");
        router.push("/integrations");
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

          <div className="space-y-2">
            <Label>Name</Label>
            <Input name="name" required placeholder="e.g. Compound A — MikroTik" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label>Adapter kind</Label>
            <Select name="adapter_kind" defaultValue="rest">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ADAPTER_KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Endpoint URL</Label>
            <Input name="endpoint_url" placeholder="https://router.compound.local/api or rtu://..." />
          </div>
          <div className="space-y-2">
            <Label>Health-check URL</Label>
            <Input name="health_check_url" placeholder="optional, GET should return 200" />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Config (JSON)</Label>
            <Textarea name="config" rows={5} placeholder={'{"host":"192.168.1.1","port":8728,"username":"api","secret_ref":"vault:mikrotik_pass"}'} />
            {errors.config && <p className="text-xs text-destructive">{errors.config}</p>}
            <p className="text-[11px] text-muted-foreground">
              Do NOT paste raw credentials here. Use <code>secret_ref</code> pointers; secrets live in Supabase Vault.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Initial status</Label>
            <Select name="status" defaultValue="configured">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="disconnected">Disconnected</SelectItem>
                <SelectItem value="configured">Configured</SelectItem>
                <SelectItem value="connected">Connected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Create integration"}</Button>
      </div>
    </form>
  );
}
