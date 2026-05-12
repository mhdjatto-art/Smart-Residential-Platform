import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/guards";
import { ROLE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div>
      <PageHeader title="Settings" description="Account preferences and access details." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Information from your Supabase auth profile.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <Row label="Email" value={user.email ?? "—"} />
            <Row label="User ID" value={<span className="font-mono text-xs">{user.id}</span>} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roles & scope</CardTitle>
            <CardDescription>Where you're allowed to operate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {user.isSuperAdmin && <Badge>Super admin</Badge>}
            {user.roles.length === 0 && !user.isSuperAdmin && (
              <p className="text-muted-foreground">No roles assigned yet.</p>
            )}
            {user.roles.map((r) => (
              <div key={r.id} className="rounded-md border bg-muted/40 p-3">
                <p className="font-medium">{ROLE_LABELS[r.role]}</p>
                <p className="text-xs text-muted-foreground">
                  {r.compound_id
                    ? "Compound-scoped"
                    : r.organization_id
                      ? "Organization-wide"
                      : "Platform-wide"}
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
