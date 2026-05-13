import type { Metadata } from "next";
import { Link2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { InviteGenerator } from "@/components/admin/invite-generator";
import { requireRole } from "@/lib/auth/guards";
import { listUnitOptions } from "@/lib/api/units";
import { createClient } from "@/lib/supabase/server";
import type { InviteRow } from "@/lib/api/invites";

export const metadata: Metadata = { title: "Resident invites" };
export const dynamic = "force-dynamic";

export default async function AdminInvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const sp = await searchParams;
  const units = await listUnitOptions();

  const selectedUnitId = sp.unit ?? units[0]?.id;
  let invites: InviteRow[] = [];
  if (selectedUnitId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("resident_invites")
      .select("*")
      .eq("unit_id", selectedUnitId)
      .order("created_at", { ascending: false });
    invites = (data ?? []) as unknown as InviteRow[];
  }

  return (
    <div>
      <PageHeader
        title="Resident invites"
        description="Generate one-time invite links so residents can self-register. Each link is tied to one unit."
      />

      {units.length === 0 ? (
        <Card><CardContent className="py-10 text-center">
          <Link2 className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">Create a unit first.</p>
        </CardContent></Card>
      ) : (
        <>
          {/* Unit picker */}
          <form className="mb-4 flex items-center gap-2">
            <label htmlFor="unit" className="text-sm text-muted-foreground">Unit:</label>
            <select
              id="unit"
              name="unit"
              defaultValue={selectedUnitId}
              className="flex h-10 rounded-md border bg-background px-2 text-sm"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.building_name ? `${u.building_name} · ` : ""}{u.unit_number}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">Switch</button>
          </form>

          {selectedUnitId && <InviteGenerator unitId={selectedUnitId} existing={invites} />}
        </>
      )}
    </div>
  );
}
