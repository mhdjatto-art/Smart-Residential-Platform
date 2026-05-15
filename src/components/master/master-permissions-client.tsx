"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, ToggleLeft, Sparkles, Shield, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  setFeatureFlag,
  setRoleCapabilityOverride,
  clearRoleCapabilityOverride,
  type FeatureFlag,
  type RoleCapabilityOverride,
} from "@/lib/api/master-permissions";
import { useT } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n";

const ROLE_LABEL_KEYS: Record<string, string> = {
  super_admin:      "permissions.role_super_admin",
  developer_admin:  "permissions.role_developer_admin",
  compound_manager: "permissions.role_compound_manager",
  finance_officer:  "permissions.role_finance_officer",
  maintenance_staff:"permissions.role_maintenance_staff",
  security_staff:   "permissions.role_security_staff",
  resident:         "permissions.role_resident",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin:      "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  developer_admin:  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200",
  compound_manager: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  finance_officer:  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  maintenance_staff:"bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  security_staff:   "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  resident:         "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

interface Props {
  flags:         FeatureFlag[];
  overrides:     RoleCapabilityOverride[];
  defaultMatrix: Record<string, Record<string, boolean>>;
  roles:         string[];
  capabilities:  string[];
}

export function MasterPermissionsClient({
  flags, overrides, defaultMatrix, roles, capabilities,
}: Props) {
  const { t } = useT();
  const roleLabel = (r: string) =>
    ROLE_LABEL_KEYS[r] ? t(ROLE_LABEL_KEYS[r] as TranslationKey) : r;
  const [tab, setTab]         = useState<"features" | "roles">("features");
  const [search, setSearch]   = useState("");
  const [pending, startTransition] = useTransition();
  const [flagsState, setFlagsState] = useState<FeatureFlag[]>(flags);
  const [overridesState, setOverridesState] = useState<RoleCapabilityOverride[]>(overrides);

  /* ─── Effective matrix = defaults + overrides ─── */
  const effectiveMatrix = useMemo(() => {
    const m: Record<string, Record<string, boolean>> = {};
    for (const r of roles) {
      m[r] = { ...(defaultMatrix[r] ?? {}) };
    }
    for (const o of overridesState) {
      if (m[o.role]) m[o.role]![o.capability] = o.enabled;
    }
    return m;
  }, [roles, defaultMatrix, overridesState]);

  const filteredCaps = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return capabilities;
    return capabilities.filter((c) => c.toLowerCase().includes(q));
  }, [capabilities, search]);

  const filteredFlags = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return flagsState;
    return flagsState.filter((f) =>
      f.feature_key.toLowerCase().includes(q) ||
      String(f.metadata?.label_ar ?? "").toLowerCase().includes(q) ||
      String(f.metadata?.label_en ?? "").toLowerCase().includes(q),
    );
  }, [flagsState, search]);

  /* ─── Handlers ─── */
  function toggleFeature(flag: FeatureFlag, newEnabled: boolean) {
    startTransition(async () => {
      try {
        await setFeatureFlag(flag.organization_id, flag.feature_key, newEnabled, flag.metadata);
        setFlagsState((prev) =>
          prev.map((f) => (f.feature_key === flag.feature_key ? { ...f, enabled: newEnabled } : f))
        );
        toast.success(newEnabled ? t("permissions.feature_enabled_toast") : t("permissions.feature_disabled_toast"), {
          description: String(flag.metadata?.label_ar ?? flag.feature_key),
        });
      } catch (e) {
        toast.error(t("permissions.update_failed"), {
          description: e instanceof Error ? e.message : "Unknown",
        });
      }
    });
  }

  function toggleCapability(role: string, capability: string, current: boolean) {
    const next = !current;
    startTransition(async () => {
      try {
        await setRoleCapabilityOverride(null, role, capability, next);
        setOverridesState((prev) => {
          const idx = prev.findIndex((o) => o.role === role && o.capability === capability);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx]!, enabled: next };
            return copy;
          }
          return [
            ...prev,
            {
              id:              crypto.randomUUID(),
              organization_id: null,
              role,
              capability,
              enabled:         next,
              updated_at:      new Date().toISOString(),
            },
          ];
        });
        toast.success(next ? t("permissions.capability_granted_toast") : t("permissions.capability_revoked_toast"), {
          description: `${roleLabel(role)} · ${capability}`,
        });
      } catch (e) {
        toast.error(t("permissions.update_failed"), {
          description: e instanceof Error ? e.message : "Unknown",
        });
      }
    });
  }

  function resetCapability(role: string, capability: string) {
    startTransition(async () => {
      try {
        await clearRoleCapabilityOverride(null, role, capability);
        setOverridesState((prev) =>
          prev.filter((o) => !(o.role === role && o.capability === capability))
        );
        toast.info(t("permissions.reset_to_default_toast"));
      } catch (e) {
        toast.error(t("permissions.update_failed"), { description: e instanceof Error ? e.message : "Unknown" });
      }
    });
  }

  function isOverridden(role: string, capability: string): boolean {
    return overridesState.some((o) => o.role === role && o.capability === capability);
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setTab("features")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition ${
            tab === "features"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          {t("permissions.tab_features")}
        </button>
        <button
          type="button"
          onClick={() => setTab("roles")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition ${
            tab === "roles"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Shield className="h-4 w-4" />
          {t("permissions.tab_roles")}
        </button>
      </div>

      {/* Search */}
      <Input
        placeholder={tab === "features" ? t("permissions.search_features") : t("permissions.search_capabilities")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Feature Flags Tab */}
      {tab === "features" && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredFlags.map((flag) => {
            const isBeta = Boolean(flag.metadata?.beta);
            return (
              <Card key={flag.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm">
                        {String(flag.metadata?.label_ar ?? flag.feature_key)}
                      </CardTitle>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">{flag.feature_key}</p>
                    </div>
                    {isBeta && <Badge variant="muted" className="text-[10px]">{t("permissions.beta_badge")}</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {flag.enabled ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className={`text-xs font-medium ${flag.enabled ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {flag.enabled ? t("permissions.feature_enabled") : t("permissions.feature_disabled")}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant={flag.enabled ? "outline" : "default"}
                      onClick={() => toggleFeature(flag, !flag.enabled)}
                      disabled={pending}
                    >
                      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ToggleLeft className="h-3 w-3" />}
                      {flag.enabled ? t("permissions.feature_turn_off") : t("permissions.feature_turn_on")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredFlags.length === 0 && (
            <p className="col-span-full rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              {t("permissions.no_features")}
            </p>
          )}
        </div>
      )}

      {/* Role Capabilities Tab */}
      {tab === "roles" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="sticky right-0 z-10 bg-muted/40 px-3 py-2 text-right">{t("permissions.table_capability")}</th>
                    {roles.map((r) => (
                      <th key={r} className="px-2 py-2 text-center">
                        <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 ${ROLE_COLORS[r] ?? "bg-muted"}`}>
                          {roleLabel(r)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCaps.map((cap) => (
                    <tr key={cap} className="border-t">
                      <td className="sticky right-0 z-10 bg-card px-3 py-2 font-mono text-[11px]">
                        {cap}
                      </td>
                      {roles.map((r) => {
                        const allowed   = effectiveMatrix[r]?.[cap] ?? false;
                        const overridden = isOverridden(r, cap);
                        return (
                          <td key={r} className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleCapability(r, cap, allowed)}
                              disabled={pending}
                              title={overridden ? t("permissions.title_overridden") : t("permissions.title_default")}
                              className={`group inline-flex h-7 w-7 items-center justify-center rounded transition ${
                                allowed
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                              } ${overridden ? "ring-2 ring-amber-400" : ""}`}
                            >
                              {allowed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            </button>
                            {overridden && (
                              <button
                                type="button"
                                onClick={() => resetCapability(r, cap)}
                                disabled={pending}
                                className="ms-1 text-muted-foreground hover:text-foreground"
                                title={t("permissions.title_reset_default")}
                              >
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "roles" && (
        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">💡 {t("permissions.how_to_use")}</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>{t("permissions.tip_legend")}</li>
            <li>{t("permissions.tip_override")}</li>
            <li>
              <RotateCcw className="inline h-3 w-3" /> {t("permissions.tip_reset")}
            </li>
            <li>{t("permissions.tip_immediate")}</li>
          </ul>
        </div>
      )}
    </div>
  );
}
