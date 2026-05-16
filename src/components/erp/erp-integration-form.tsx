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
import { erpIntegrationSchema, ERP_KINDS } from "@/lib/validations/erp";
import { createErpIntegration } from "@/lib/api/erp";

interface OrgOption { id: string; name: string; }
interface ErpIntegrationFormProps { organizations: OrgOption[]; }

function safeJson(s: string): Record<string, unknown> {
  if (!s.trim()) return {};
  try { return JSON.parse(s); } catch { return { __invalid: true }; }
}

const HELP: Record<string, string> = {
  odoo:       "Base URL: https://your-company.odoo.com  |  Database name: production  |  Username: your@email  |  API key: from Odoo → Settings → API Keys",
  sap:        "Base URL: https://my.s4hana.example.com  |  Company external id: BUKRS (e.g. 1000)  |  API key: SAP Gateway bearer token",
  csv:        "No remote endpoint. Journal entries dump to Supabase Storage under csv_export_path/.",
  custom:     "Your own webhook receives a JSON envelope. Configure URL + secret in config JSON.",
  generic:    "Falls back to CSV.",
  sage:       "Use REST API key from Sage. Stub adapter — provide custom adapter for production.",
  quickbooks: "OAuth tokens via QBO. Stub adapter — provide custom adapter for production.",
  xero:       "OAuth tokens via Xero. Stub adapter — provide custom adapter for production.",
};

export function ErpIntegrationForm({ organizations }: ErpIntegrationFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<string>("odoo");

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
      kind: String(fd.get("kind") ?? "odoo"),
      name: String(fd.get("name") ?? ""),
      base_url: String(fd.get("base_url") ?? ""),
      database_name: String(fd.get("database_name") ?? ""),
      username: String(fd.get("username") ?? ""),
      credentials_ref: String(fd.get("credentials_ref") ?? ""),
      company_external_id: String(fd.get("company_external_id") ?? ""),
      default_currency: String(fd.get("default_currency") ?? "IQD"),
      config,
      is_active: true,
      auto_push: fd.get("auto_push") === "on",
      csv_export_path: String(fd.get("csv_export_path") ?? ""),
    };
    const parsed = erpIntegrationSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) next[k] = (v ?? [])[0]!;
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        await createErpIntegration(parsed.data);
        toast.success("Integration created");
        router.push("/erp");
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
            <Label>ERP kind</Label>
            <Select name="kind" value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ERP_KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{HELP[kind] ?? ""}</p>
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input name="name" required placeholder="e.g. Odoo Production" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {kind !== "csv" && (
            <>
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input name="base_url" placeholder="https://your-company.odoo.com" />
              </div>
              <div className="space-y-2">
                <Label>Database / Tenant</Label>
                <Input name="database_name" placeholder={kind === "odoo" ? "production" : "(optional)"} />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input name="username" />
              </div>
              <div className="space-y-2">
                <Label>API key / Vault ref</Label>
                <Input name="credentials_ref" placeholder="vault:erp_odoo_main" />
                <p className="text-[11px] text-muted-foreground">Do not paste the raw secret. Use a Vault reference.</p>
              </div>
              <div className="space-y-2">
                <Label>Company external ID</Label>
                <Input name="company_external_id" placeholder={kind === "odoo" ? "1" : "BUKRS (e.g. 1000)"} />
              </div>
            </>
          )}

          {kind === "csv" && (
            <div className="md:col-span-2 space-y-2">
              <Label>CSV export path</Label>
              <Input name="csv_export_path" placeholder="exports/journal" />
              <p className="text-[11px] text-muted-foreground">
                Journal entries will dump as CSVs to <code>{`{path}/{entry_number}.csv`}</code> in Supabase Storage.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Default currency</Label>
            <Input name="default_currency" defaultValue="IQD" />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="auto_push" defaultChecked className="h-4 w-4" />
              Auto-push journal entries on payment confirmation
            </label>
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Adapter config (JSON)</Label>
            <Textarea name="config" rows={4} placeholder='{"tax_account_id":2200,"partner_create_if_missing":true}' />
            {errors.config && <p className="text-xs text-destructive">{errors.config}</p>}
            <p className="text-[11px] text-muted-foreground">Adapter-specific extras. Safe to leave empty.</p>
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
