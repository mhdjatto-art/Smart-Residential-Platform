import { Building2, Home, Users, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  /*
   * RLS limits these counts to what the user is allowed to see, so we don't
   * need to add a `where organization_id in (...)` clause manually. The query
   * is the same regardless of role, and the DB returns the correct slice.
   */
  const [compounds, buildings, units, residents] = await Promise.all([
    supabase.from("compounds").select("id", { count: "exact", head: true }),
    supabase.from("buildings").select("id", { count: "exact", head: true }),
    supabase.from("units").select("id", { count: "exact", head: true }),
    supabase.from("residents").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const { data: recentResidents } = await supabase
    .from("residents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  const primaryRole = user.roles[0]?.role;

  return (
    <div>
      <PageHeader
        title={`Welcome back${user.email ? `, ${user.email.split("@")[0]}` : ""}`}
        description={
          primaryRole
            ? `Signed in as ${ROLE_LABELS[primaryRole]}.`
            : "Your account is set up — ask your administrator to assign a role."
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Compounds" value={compounds.count ?? 0} icon={Warehouse} />
        <StatCard label="Buildings" value={buildings.count ?? 0} icon={Building2} />
        <StatCard label="Units" value={units.count ?? 0} icon={Home} />
        <StatCard label="Active residents" value={residents.count ?? 0} icon={Users} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent residents</CardTitle>
            <CardDescription>The five most recently added residents in your scope.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentResidents && recentResidents.length > 0 ? (
              <ul className="divide-y">
                {recentResidents.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">
                        {r.first_name} {r.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{r.email ?? "no email on file"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={r.status === "active" ? "success" : r.status === "former" ? "muted" : "warning"}>
                        {r.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-sm text-muted-foreground">No residents yet — add one from the Residents page.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your access</CardTitle>
            <CardDescription>Roles linked to your account.</CardDescription>
          </CardHeader>
          <CardContent>
            {user.isSuperAdmin && (
              <div className="mb-3">
                <Badge>Super admin (platform-wide)</Badge>
              </div>
            )}
            {user.roles.length === 0 && !user.isSuperAdmin && (
              <p className="text-sm text-muted-foreground">
                No roles assigned yet. Ask your administrator to give you access.
              </p>
            )}
            <ul className="space-y-2">
              {user.roles.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
                  <div>
                    <p className="text-sm font-medium">{ROLE_LABELS[r.role]}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.compound_id ? "Compound-scoped" : r.organization_id ? "Organization-wide" : "Platform"}
                    </p>
                  </div>
                  {r.is_primary && <Badge variant="muted">Primary</Badge>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
