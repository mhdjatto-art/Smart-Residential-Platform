import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/auth/guards";
import { listFeatureFlags, listRoleCapabilityOverrides } from "@/lib/api/master-permissions";
import { ROLE_CAPABILITIES } from "@/lib/auth/permissions";
import { MasterPermissionsClient } from "@/components/master/master-permissions-client";

export const metadata: Metadata = { title: "Master Permissions" };
export const dynamic = "force-dynamic";

export default async function MasterPermissionsPage() {
  await requireRole(["super_admin","developer_admin"]);

  // Load the GLOBAL defaults (orgId = null). Future iteration can scope per-org.
  const [flags, overrides] = await Promise.all([
    listFeatureFlags(null),
    listRoleCapabilityOverrides(null),
  ]);

  // Convert ROLE_CAPABILITIES into a plain matrix for the client.
  const roles = Object.keys(ROLE_CAPABILITIES) as Array<keyof typeof ROLE_CAPABILITIES>;
  const allCapabilities = Array.from(
    new Set(roles.flatMap((r) => ROLE_CAPABILITIES[r]))
  ).sort();
  const defaultMatrix: Record<string, Record<string, boolean>> = {};
  for (const r of roles) {
    defaultMatrix[r as string] = {};
    for (const c of allCapabilities) {
      defaultMatrix[r as string]![c] = ROLE_CAPABILITIES[r].includes(c);
    }
  }

  return (
    <div>
      <PageHeader
        title="Master permissions center"
        description="Control feature toggles and customize permissions for each role. Changes apply immediately to every user."
        titleKey="permissions.page_title"
        descKey="permissions.page_desc"
      />
      <MasterPermissionsClient
        flags={flags}
        overrides={overrides}
        defaultMatrix={defaultMatrix}
        roles={roles as string[]}
        capabilities={allCapabilities}
      />
    </div>
  );
}
