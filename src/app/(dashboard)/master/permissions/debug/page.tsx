/**
 * Phase 17 debug — surface the EFFECTIVE state seen by the enforcement layer.
 * Open this page after toggling a flag in /master/permissions to verify the
 * change actually applies. Only super_admin / developer_admin can see it.
 */
import { requireRole, requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getEnabledFeatures } from "@/lib/auth/feature-flags";
import { getEffectiveCapabilities } from "@/lib/auth/effective-permissions";

export const dynamic = "force-dynamic";

export default async function PermissionsDebugPage() {
  await requireRole(["super_admin", "developer_admin"]);
  const user = await requireUser();
  const roleNames = user.roles.map((r) => r.role);
  const primaryOrgId = user.roles.find((r) => r.is_primary)?.organization_id
    ?? user.organizationIds[0] ?? null;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [flagsRaw, overridesRaw] = await Promise.all([
    sb.from("feature_flags").select("organization_id, feature_key, enabled, updated_at").order("feature_key").order("updated_at", { ascending: false }),
    sb.from("role_capability_overrides").select("organization_id, role, capability, enabled, updated_at").order("role").order("capability").order("updated_at", { ascending: false }),
  ]);

  const [enabledFeatures, effectiveCaps] = await Promise.all([
    getEnabledFeatures(primaryOrgId),
    getEffectiveCapabilities(roleNames, primaryOrgId),
  ]);

  return (
    <div className="space-y-6 font-mono text-xs">
      <h1 className="text-xl font-bold">Phase 17 Debug</h1>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold">Identity</h2>
        <pre className="whitespace-pre-wrap">{JSON.stringify({
          user_id: user.id,
          email:   user.email,
          roles:   roleNames,
          primary_org_id: primaryOrgId,
          is_super_admin: user.isSuperAdmin,
        }, null, 2)}</pre>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold">Resolved (what Sidebar sees)</h2>
        <p className="text-muted-foreground">
          enabledFeatures.size: <b>{enabledFeatures.size}</b> · effectiveCaps.size: <b>{effectiveCaps.size}</b>
        </p>
        <details className="mt-2">
          <summary>enabledFeatures ({enabledFeatures.size})</summary>
          <pre className="whitespace-pre-wrap">{JSON.stringify(Array.from(enabledFeatures).sort(), null, 2)}</pre>
        </details>
        <details className="mt-2">
          <summary>effectiveCapabilities ({effectiveCaps.size})</summary>
          <pre className="whitespace-pre-wrap">{JSON.stringify(Array.from(effectiveCaps).sort(), null, 2)}</pre>
        </details>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold">Raw feature_flags rows ({flagsRaw.data?.length ?? 0})</h2>
        {flagsRaw.error && <p className="text-destructive">ERR: {flagsRaw.error.message}</p>}
        <details>
          <summary>Show raw rows</summary>
          <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(flagsRaw.data ?? [], null, 2)}</pre>
        </details>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold">Raw role_capability_overrides rows ({overridesRaw.data?.length ?? 0})</h2>
        {overridesRaw.error && <p className="text-destructive">ERR: {overridesRaw.error.message}</p>}
        <details>
          <summary>Show raw rows</summary>
          <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(overridesRaw.data ?? [], null, 2)}</pre>
        </details>
      </section>
    </div>
  );
}
