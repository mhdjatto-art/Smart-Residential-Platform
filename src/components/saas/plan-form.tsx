"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createPlan, updatePlan, deletePlan, type PlanInput, type SubscriptionPlanRow } from "@/lib/api/saas";

interface PlanFormProps {
  initial?: SubscriptionPlanRow;
  mode: "create" | "edit";
}

const TIERS = ["starter", "professional", "enterprise", "custom"] as const;

export function PlanForm({ initial, mode }: PlanFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();

  const [form, setForm] = useState<PlanInput>({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    tier: (initial?.tier as PlanInput["tier"]) ?? "starter",
    description: initial?.description ?? "",
    monthly_price: initial?.monthly_price ?? 0,
    annual_price: initial?.annual_price ?? 0,
    currency: initial?.currency ?? "USD",
    max_compounds: initial?.max_compounds ?? null,
    max_units: initial?.max_units ?? null,
    max_residents: initial?.max_residents ?? null,
    max_admin_users: initial?.max_admin_users ?? null,
    max_storage_mb: initial?.max_storage_mb ?? null,
    max_api_calls_per_month: initial?.max_api_calls_per_month ?? null,
    is_active: initial?.is_active ?? true,
    display_order: initial?.display_order ?? 0,
  });

  function set<K extends keyof PlanInput>(key: K, value: PlanInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function numOrNull(s: string): number | null {
    if (s.trim() === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Code and name are required");
      return;
    }
    startTransition(async () => {
      try {
        if (mode === "create") {
          const id = await createPlan(form);
          toast.success("Plan created");
          router.push(`/saas-console/plans/${id}/edit`);
        } else if (initial) {
          await updatePlan(initial.id, form);
          toast.success("Plan updated");
          router.refresh();
        }
      } catch (err) {
        toast.error("Save failed", { description: err instanceof Error ? err.message : "Unknown error" });
      }
    });
  }

  function onDelete() {
    if (!initial) return;
    if (!confirm(`Delete plan "${initial.name}"? This cannot be undone.`)) return;
    startDelete(async () => {
      try {
        await deletePlan(initial.id);
        toast.success("Plan deleted");
        router.push("/saas-console/plans");
        router.refresh();
      } catch (err) {
        toast.error("Delete failed", { description: err instanceof Error ? err.message : "Unknown error" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
          <CardDescription>The visible identity and tier of this plan.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" value={form.code} onChange={(e) => set("code", e.target.value.toLowerCase())}
              placeholder="starter" pattern="[a-z0-9_-]{2,32}" required />
            <p className="text-[11px] text-muted-foreground">2-32 lowercase chars, digits, _ or -</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="Starter" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tier">Tier</Label>
            <select id="tier" value={form.tier} onChange={(e) => set("tier", e.target.value as PlanInput["tier"])}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="display_order">Display order</Label>
            <Input id="display_order" type="number" value={form.display_order}
              onChange={(e) => set("display_order", Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What's included in this plan…" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>Set to 0 for free plans.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="monthly_price">Monthly price</Label>
            <Input id="monthly_price" type="number" min={0} step="0.01" value={form.monthly_price}
              onChange={(e) => set("monthly_price", Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="annual_price">Annual price</Label>
            <Input id="annual_price" type="number" min={0} step="0.01" value={form.annual_price}
              onChange={(e) => set("annual_price", Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())}
              maxLength={3} placeholder="USD" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quotas</CardTitle>
          <CardDescription>Leave blank for unlimited (∞).</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {([
            ["max_compounds", "Compounds"],
            ["max_units", "Units"],
            ["max_residents", "Residents"],
            ["max_admin_users", "Admin users"],
            ["max_storage_mb", "Storage (MB)"],
            ["max_api_calls_per_month", "API calls / month"],
          ] as const).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{label}</Label>
              <Input id={key} type="number" min={0}
                value={form[key] === null || form[key] === undefined ? "" : String(form[key])}
                onChange={(e) => set(key, numOrNull(e.target.value) as never)}
                placeholder="Unlimited" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visibility</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)} />
            Plan is active and available for new organizations
          </label>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || deleting}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {mode === "create" ? "Create plan" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending || deleting}>
            Cancel
          </Button>
        </div>
        {mode === "edit" && (
          <Button type="button" variant="destructive" onClick={onDelete} disabled={pending || deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete plan
          </Button>
        )}
      </div>
    </form>
  );
}
