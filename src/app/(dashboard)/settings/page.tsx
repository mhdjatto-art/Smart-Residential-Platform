import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireUser, requireCapability } from "@/lib/auth/guards";
import { ROLE_LABEL_KEYS } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireCapability("compound:read");
  const user = await requireUser();
  const { t } = await getT();

  return (
    <div>
      <PageHeader titleKey="headers.settings_title" descKey="headers.settings_desc" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("headers.account_title")}</CardTitle>
            <CardDescription>{t("headers.account_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <Row label={t("common.email_col")} value={user.email ?? "—"} />
            <Row label={t("tables.user_id")} value={<span className="font-mono text-xs">{user.id}</span>} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("headers.roles_scope_title")}</CardTitle>
            <CardDescription>{t("headers.roles_scope_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {user.isSuperAdmin && <Badge>{t("roles.super_admin_platform_wide")}</Badge>}
            {user.roles.length === 0 && !user.isSuperAdmin && (
              <p className="text-muted-foreground">{t("roles.no_roles_assigned")}</p>
            )}
            {user.roles.map((r) => (
              <div key={r.id} className="rounded-md border bg-muted/40 p-3">
                <p className="font-medium">{t(ROLE_LABEL_KEYS[r.role])}</p>
                <p className="text-xs text-muted-foreground">
                  {r.compound_id
                    ? t("roles.scope_compound")
                    : r.organization_id
                      ? t("roles.scope_organization")
                      : t("roles.scope_platform")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
