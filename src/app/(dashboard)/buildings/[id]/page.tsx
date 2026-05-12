import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Edit, Home, Layers } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { FloorList } from "@/components/floors/floor-list";
import { getBuilding } from "@/lib/api/buildings";
import { listFloors } from "@/lib/api/floors";
import { listUnitsPaged } from "@/lib/api/units";

export const dynamic = "force-dynamic";

export default async function BuildingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const building = await getBuilding(id);
  if (!building) notFound();

  const [floors, units] = await Promise.all([
    listFloors(id),
    listUnitsPaged({ buildingId: id, pageSize: 50 }),
  ]);

  return (
    <div>
      <PageHeader
        title={building.name}
        description={building.description ?? "Building details"}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/compounds/${building.compound_id}`}><ArrowLeft className="h-4 w-4" />Compound</Link>
            </Button>
            <Button asChild>
              <Link href={`/buildings/${building.id}/edit`}><Edit className="h-4 w-4" />Edit</Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total units" value={building.total_units} icon={Home} />
        <StatCard label="Floors defined" value={floors.length} icon={Layers} />
        <Card>
          <CardContent className="flex flex-col gap-2 p-6">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</span>
            <StatusBadge status={building.status} className="w-fit" />
            <span className="text-xs text-muted-foreground">
              Code: {building.code ?? "—"}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Units</CardTitle>
            <Button asChild size="sm"><Link href={`/units/new?building=${building.id}`}>Add unit</Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            {units.data.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No units yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Beds</TableHead>
                    <TableHead className="text-right">Area</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.data.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <Link href={`/units/${u.id}`} className="font-medium hover:underline">{u.unit_number}</Link>
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">{u.unit_type}</TableCell>
                      <TableCell><StatusBadge status={u.status} /></TableCell>
                      <TableCell className="text-right tabular-nums">{u.bedrooms ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{u.area_sqm ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Floors</CardTitle></CardHeader>
          <CardContent>
            <FloorList buildingId={building.id} floors={floors} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
