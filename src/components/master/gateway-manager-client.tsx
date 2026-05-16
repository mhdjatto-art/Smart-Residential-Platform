"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, CreditCard, Loader2, Pencil, Plus, Power, Trash2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createGateway, deleteGateway, getGateway, toggleGateway, updateGateway,
  type GatewayRow,
} from "@/lib/api/gateway-manager";
import {
  CREDENTIAL_SCHEMA, PROVIDER_LABELS, BUILTIN_PROVIDERS, ONLINE_PROVIDERS,
  type CredentialField, type ProviderId,
} from "@/lib/payments/gateway-types";
import { useT } from "@/lib/i18n/client";

interface Props { initial: GatewayRow[]; }

export function GatewayManagerClient({ initial }: Props) {
  const { t } = useT();
  const router = useRouter();
  const [rows, setRows] = useState<GatewayRow[]>(initial);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<GatewayRow | null>(null);
  const [adding, setAdding]   = useState(false);

  function refresh() { router.refresh(); }

  function handleToggle(id: string, next: boolean) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, enabled: next } : r));
    startTransition(async () => {
      try {
        await toggleGateway(id, next);
        toast.success(next ? t("gateways.enabled_toast") : t("gateways.disabled_toast"));
      } catch (e) {
        toast.error(t("gateways.update_failed"), { description: e instanceof Error ? e.message : "" });
        setRows((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !next } : r));
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm(t("gateways.confirm_delete"))) return;
    startTransition(async () => {
      try {
        await deleteGateway(id);
        setRows((prev) => prev.filter((r) => r.id !== id));
        toast.success(t("gateways.deleted_toast"));
      } catch (e) {
        toast.error(t("gateways.delete_failed"), { description: e instanceof Error ? e.message : "" });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={adding} onOpenChange={setAdding}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 me-1" />
              {t("gateways.add_button")}
            </Button>
          </DialogTrigger>
          <AddGatewayDialog
            existingProviders={rows.map((r) => r.provider)}
            onClose={() => { setAdding(false); refresh(); }}
          />
        </Dialog>
      </div>

      {rows.length === 0 ? (
        <Card><CardContent className="p-10 text-center">
          <CreditCard className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">{t("gateways.empty")}</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => {
            const isBuiltin = BUILTIN_PROVIDERS.includes(r.provider);
            const needsCreds = ONLINE_PROVIDERS.includes(r.provider);
            const credentialsMissing = needsCreds && !r.has_credentials;
            return (
              <Card key={r.id} className={r.enabled ? "" : "opacity-70"}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{r.display_name}</CardTitle>
                        {isBuiltin && <Badge variant="muted" className="text-[10px]">{t("gateways.built_in")}</Badge>}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{PROVIDER_LABELS[r.provider]}</p>
                    </div>
                    <Switch checked={r.enabled} onCheckedChange={(v) => handleToggle(r.id, v)} disabled={pending} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {/* Status row */}
                  <div className="flex items-center gap-2 text-xs">
                    {r.enabled ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />{t("gateways.status_active")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5" />{t("gateways.status_disabled")}
                      </span>
                    )}
                    {credentialsMissing && (
                      <Badge variant="destructive" className="text-[10px]">
                        {t("gateways.no_credentials")}
                      </Badge>
                    )}
                  </div>

                  {/* Currencies + methods */}
                  <div className="flex flex-wrap gap-1">
                    {(r.supported_currencies.length ? r.supported_currencies : ["ANY"]).map((c) => (
                      <Badge key={c} variant="muted" className="text-[10px] font-mono">{c}</Badge>
                    ))}
                    {r.supported_methods.map((m) => (
                      <Badge key={m} className="text-[10px]" variant="outline">{m}</Badge>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(r)} disabled={pending}>
                      <Pencil className="h-3.5 w-3.5 me-1" />{t("gateways.edit")}
                    </Button>
                    {!isBuiltin && (
                      <Button size="sm" variant="outline" onClick={() => handleDelete(r.id)} disabled={pending}
                        className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5 me-1" />{t("gateways.delete")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      {editing && (
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <EditGatewayDialog
            gateway={editing}
            onClose={() => { setEditing(null); refresh(); }}
          />
        </Dialog>
      )}
    </div>
  );
}

/* ─── Add dialog ───────────────────────────────────────────────────────── */

function AddGatewayDialog({
  existingProviders, onClose,
}: { existingProviders: ProviderId[]; onClose: () => void }) {
  const { t } = useT();
  const [provider, setProvider] = useState<ProviderId>("nass");
  const [displayName, setDisplayName] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const fields = CREDENTIAL_SCHEMA[provider];
  // Filter out providers already configured globally
  const available = (Object.keys(PROVIDER_LABELS) as ProviderId[])
    .filter((p) => !BUILTIN_PROVIDERS.includes(p))
    .filter((p) => !existingProviders.includes(p));

  function submit() {
    if (!displayName.trim()) { toast.error(t("gateways.display_name_required")); return; }
    const missing = fields.filter((f) => f.required && !credentials[f.key]?.trim());
    if (missing.length) {
      toast.error(t("gateways.fields_required"), { description: missing.map((f) => f.label).join(", ") });
      return;
    }
    startTransition(async () => {
      try {
        await createGateway({
          provider,
          display_name: displayName.trim(),
          credentials,
          enabled: true,
        });
        toast.success(t("gateways.created_toast"));
        onClose();
      } catch (e) {
        toast.error(t("gateways.create_failed"), { description: e instanceof Error ? e.message : "" });
      }
    });
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{t("gateways.add_title")}</DialogTitle>
        <DialogDescription>{t("gateways.add_desc")}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>{t("gateways.provider")}</Label>
          <Select value={provider} onValueChange={(v) => { setProvider(v as ProviderId); setCredentials({}); setDisplayName(PROVIDER_LABELS[v as ProviderId]); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {available.map((p) => (
                <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t("gateways.display_name")}</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={PROVIDER_LABELS[provider]} />
        </div>

        {/* Dynamic credential fields */}
        {fields.map((f) => (
          <CredentialInput
            key={f.key}
            field={f}
            value={credentials[f.key] ?? ""}
            onChange={(v) => setCredentials((prev) => ({ ...prev, [f.key]: v }))}
          />
        ))}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={pending}>{t("actions.cancel")}</Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Power className="h-4 w-4 me-1" />}
          {t("gateways.create_button")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ─── Edit dialog ──────────────────────────────────────────────────────── */

function EditGatewayDialog({ gateway, onClose }: { gateway: GatewayRow; onClose: () => void }) {
  const { t } = useT();
  const [displayName, setDisplayName] = useState(gateway.display_name);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const fields = CREDENTIAL_SCHEMA[gateway.provider];

  // Lazy-load full credentials (the listing only flagged whether they exist)
  if (!loaded) {
    startTransition(async () => {
      try {
        const full = await getGateway(gateway.id);
        if (full?.credentials) {
          const masked: Record<string, string> = {};
          for (const f of fields) {
            const v = full.credentials[f.key];
            masked[f.key] = typeof v === "string" ? v : "";
          }
          setCredentials(masked);
        }
      } finally { setLoaded(true); }
    });
  }

  function submit() {
    startTransition(async () => {
      try {
        await updateGateway({
          id: gateway.id,
          display_name: displayName.trim() || gateway.display_name,
          credentials: credentials,
        });
        toast.success(t("gateways.updated_toast"));
        onClose();
      } catch (e) {
        toast.error(t("gateways.update_failed"), { description: e instanceof Error ? e.message : "" });
      }
    });
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{t("gateways.edit_title")}: {PROVIDER_LABELS[gateway.provider]}</DialogTitle>
        <DialogDescription>{t("gateways.edit_desc")}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>{t("gateways.display_name")}</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("gateways.no_credentials_needed")}</p>
        ) : !loaded ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}</p>
        ) : fields.map((f) => (
          <CredentialInput
            key={f.key}
            field={f}
            value={credentials[f.key] ?? ""}
            onChange={(v) => setCredentials((prev) => ({ ...prev, [f.key]: v }))}
          />
        ))}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={pending}>{t("actions.cancel")}</Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
          {t("actions.save")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ─── Dynamic credential field renderer ─────────────────────────────────── */

function CredentialInput({
  field, value, onChange,
}: { field: CredentialField; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      {field.type === "select" && field.options ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder={field.placeholder} /></SelectTrigger>
          <SelectContent>
            {field.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type={field.type === "password" ? "password" : field.type === "url" ? "url" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          autoComplete="off"
        />
      )}
      {field.help && <p className="text-[11px] text-muted-foreground">{field.help}</p>}
    </div>
  );
}
