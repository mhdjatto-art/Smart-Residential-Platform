import Link from "next/link";
import { ArrowRight, Building2, Home, LogIn, LogOut, ShieldCheck, UserCheck, Users, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/lib/auth/guards";
import { ROLE_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/api/stats";
import { formatDate } from "@/lib/utils";
import type { ResidentRow } from "@/lib/api/residents";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const stats = await getDashboardStats();

  const { data: recent } = await supabase
    .from("residents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);
  const recentResidents = ((recent ?? []) as unknown as ResidentRow[]);

  const occupancyRate = stats.units > 0 ? Math.round((stats.occupied_units / stats.units) * 100) : 0;
  const primaryRole = user.roles[0]?.role;

  return (
    <div>
      <PageHeader
        title={`Welcome back${user.email ? `, ${user.email.split("@")[0]}` : ""}`}
        titleKey="headers.dashboard_title"
        description={
          primaryRole
            ? `Signed in as ${ROLE_LABELS[primaryRole]}.`
            : "Your account is set up — ask your administrator to assign a role."
        }
        descKey="headers.dashboard_desc"
      />

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Compounds" value={stats.compounds} icon={Warehouse} />
        <StatCard label="Buildings" value={stats.buildings} icon={Building2} />
        <StatCard label="Units" value={stats.units} icon={Home} />
        <StatCard label="Active residents" value={stats.residents} icon={Users} />
      </div>

      {/* Occupancy + tenant mix */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Occupied" value={stats.occupied_units} icon={ShieldCheck} trend={{ value: `${occupancyRate}% occupancy`, positive: occupancyRate >= 50 }} />
        <StatCard label="Vacant" value={stats.vacant_units} icon={Home} />
        <StatCard label="Owners" value={stats.owners} icon={UserCheck} />
        <StatCard label="Tenants" value={stats.tenants} icon={Users} />
      </div>

      {/* Recent activity */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Move-ins (30d)" value={stats.recent_move_ins} icon={LogIn} />
        <StatCard label="Move-outs (30d)" value={stats.recent_move_outs} icon={LogOut} />
        <Card className="sm:col-span-2 lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Quick actions</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2 pb-6">
            <Button asChild size="sm"><Link href="/compounds/new">+ Compound</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/buildings/new">+ Building</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/units/new">+ Unit</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/residents/new">+ Resident</Link></Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent residents</CardTitle>
              <CardDescription>The five most recently added residents in your scope.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/residents">View all <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentResidents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tenancy</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Added</TableHead>
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
                      <TableCell className="capitalize text-muted-foreground">{r.tenancy_type.replace("_", " ")}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">No residents yet — add one from the Residents page.</p>
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
              <div className="mb-3"><Badge>Super admin (platform-wide)</Badge></div>
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
