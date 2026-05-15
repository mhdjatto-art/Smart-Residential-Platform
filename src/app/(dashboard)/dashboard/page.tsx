import Link from "next/link";
import { ArrowRight, Building2, Home, LogIn, LogOut, ShieldCheck, UserCheck, Users, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser, requireCapability } from "@/lib/auth/guards";
import { ROLE_LABEL_KEYS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/api/stats";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n";
import type { ResidentRow } from "@/lib/api/residents";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireCapability("compound:read");
  const user = await requireUser();
  const supabase = await createClient();
  const { t } = await getT();

  // Defensive: never let one failure crash the whole dashboard.
  const stats = await getDashboardStats().catch((e) => {
    console.error("[dashboard] getDashboardStats failed:", e instanceof Error ? e.message : String(e));
    return {
      compounds: 0, buildings: 0, units: 0, occupied_units: 0, vacant_units: 0,
      residents: 0, owners: 0, tenants: 0, recent_move_ins: 0, recent_move_outs: 0,
    };
  });

  let recentResidents: ResidentRow[] = [];
  try {
    const { data: recent, error } = await supabase
      .from("residents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) {
      console.error("[dashboard] recent residents query failed:", error.message);
    } else {
      recentResidents = (recent ?? []) as unknown as ResidentRow[];
    }
  } catch (e) {
    console.error("[dashboard] recent residents threw:", e instanceof Error ? e.message : String(e));
  }

  const occupancyRate = stats.units > 0 ? Math.round((stats.occupied_units / stats.units) * 100) : 0;
  const primaryRole = user.roles[0]?.role;
  const userName = user.email ? user.email.split("@")[0] : null;
  const roleLabel = primaryRole ? t(ROLE_LABEL_KEYS[primaryRole]) : null;

  // Map tenancy_type to its i18n key (falls back to raw value if unmapped).
  function tenancyLabel(raw: string | null | undefined): string {
    if (!raw) return "—";
    const key = `tenancy.${raw}` as TranslationKey;
    const out = t(key);
    // makeT returns the key path when missing; show the raw word in that case.
    return out === key ? raw.toString().replace(/_/g, " ") : out;
  }

  return (
    <div>
      <PageHeader
        title={userName ? t("dashboard.welcome_back_named", { name: userName }) : t("dashboard.welcome_back")}
        description={
          roleLabel
            ? t("roles.signed_in_as", { role: roleLabel })
            : t("roles.no_roles")
        }
      />

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("stats.total_compounds")} value={stats.compounds} icon={Warehouse} />
        <StatCard label={t("stats.total_buildings")} value={stats.buildings} icon={Building2} />
        <StatCard label={t("stats.total_units")} value={stats.units} icon={Home} />
        <StatCard label={t("stats.active_residents")} value={stats.residents} icon={Users} />
      </div>

      {/* Occupancy + tenant mix */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("stats.occupied")}
          value={stats.occupied_units}
          icon={ShieldCheck}
          trend={{ value: t("stats.occupancy_pct", { pct: occupancyRate }), positive: occupancyRate >= 50 }}
        />
        <StatCard label={t("stats.vacant")} value={stats.vacant_units} icon={Home} />
        <StatCard label={t("stats.owners")} value={stats.owners} icon={UserCheck} />
        <StatCard label={t("stats.tenants")} value={stats.tenants} icon={Users} />
      </div>

      {/* Recent activity */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("stats.move_ins_30d")} value={stats.recent_move_ins} icon={LogIn} />
        <StatCard label={t("stats.move_outs_30d")} value={stats.recent_move_outs} icon={LogOut} />
        <Card className="sm:col-span-2 lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("dashboard.quick_actions")}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2 pb-6">
            <Button asChild size="sm"><Link href="/compounds/new">{t("dashboard.add_compound")}</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/buildings/new">{t("dashboard.add_building")}</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/units/new">{t("dashboard.add_unit")}</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/residents/new">{t("dashboard.add_resident")}</Link></Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("dashboard.recent_residents")}</CardTitle>
              <CardDescription>{t("dashboard.recent_residents_desc")}</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/residents">{t("actions.view_all")} <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentResidents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("tables.name")}</TableHead>
                    <TableHead>{t("tables.email")}</TableHead>
                    <TableHead>{t("tables.tenancy")}</TableHead>
                    <TableHead>{t("tables.status")}</TableHead>
                    <TableHead className="text-right">{t("tables.added")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentResidents.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link href={`/residents/${r.id}`} className="font-medium hover:underline">
                          {r.first_name} {r.last_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.email ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{tenancyLabel(r.tenancy_type)}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">{t("dashboard.no_residents_yet")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.your_access")}</CardTitle>
            <CardDescription>{t("dashboard.roles_linked")}</CardDescription>
          </CardHeader>
          <CardContent>
            {user.isSuperAdmin && (
              <div className="mb-3"><Badge>{t("roles.super_admin_platform_wide")}</Badge></div>
            )}
            {user.roles.length === 0 && !user.isSuperAdmin && (
              <p className="text-sm text-muted-foreground">
                {t("roles.no_roles_assigned")}
              </p>
            )}
            <ul className="space-y-2">
              {user.roles.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
                  <div>
                    <p className="text-sm font-medium">{t(ROLE_LABEL_KEYS[r.role])}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.compound_id
                        ? t("roles.scope_compound")
                        : r.organization_id
                          ? t("roles.scope_organization")
                          : t("roles.scope_platform")}
                    </p>
                  </div>
                  {r.is_primary && <Badge variant="muted">{t("roles.primary")}</Badge>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
