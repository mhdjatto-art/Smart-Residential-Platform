import Link from "next/link";
import { Home, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchBar } from "@/components/shared/search-bar";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { listUnitsPaged } from "@/lib/api/units";
import { listCompoundOptions } from "@/lib/api/compounds";
import { listBuildingOptions } from "@/lib/api/buildings";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    unit_type?: string;
    ownership?: string;
    compound?: string;
    building?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const [{ data, total }, compounds, buildings] = await Promise.all([
    listUnitsPaged({
      search: sp.q,
      status: sp.status,
      unitType: sp.unit_type,
      ownershipStatus: sp.ownership,
      compoundId: sp.compound,
      buildingId: sp.building,
      page,
      pageSize: PAGE_SIZE,
    }),
    listCompoundOptions(),
    listBuildingOptions(sp.compound),
  ]);

  return (
    <div>
      <PageHeader
        title="Units"
        titleKey="headers.units_title"
        description="All units across your compounds with availability and pricing."
        descKey="headers.units_desc"
        actions={
          <Button asChild>
            <Link href="/units/new"><Plus className="h-4 w-4" />Add unit</Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2"><SearchBar placeholder="Search unit number…" /></div>
        <FilterSelect
          paramName="compound"
          placeholder="compound"
          options={compounds.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect
          paramName="building"
          placeholder="building"
          options={buildings.map((b) => ({ value: b.id, label: b.name }))}
        />
        <FilterSelect
          paramName="unit_type"
          placeholder="type"
          options={[
            "apartment","villa","townhouse","studio","duplex","penthouse","office","commercial","other",
          ].map((t) => ({ value: t, label: t }))}
        />
        <FilterSelect
          paramName="status"
          placeholder="status"
          options={[
            { value: "vacant", label: "Vacant" },
            { value: "occupied", label: "Occupied" },
            { value: "reserved", label: "Reserved" },
            { value: "maintenance", label: "Maintenance" },
          ]}
        />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Home}
          title="No units found"
          description="Adjust filters or add a unit to begin."
          action={
            <Button asChild><Link href="/units/new">Add unit</Link></Button>
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ownership</TableHead>
                <TableHead className="text-right">Beds</TableHead>
                <TableHead className="text-right">Baths</TableHead>
                <TableHead className="text-right">Area (m²)</TableHead>
                <TableHead className="text-right">Rent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link href={`/units/${u.id}`} className="font-medium hover:underline">{u.unit_number}</Link>
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{u.unit_type}</TableCell>
                  <TableCell><StatusBadge status={u.status} /></TableCell>
                  <TableCell><StatusBadge status={u.ownership_status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{u.bedrooms ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{u.bathrooms ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{u.area_sqm ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{u.rent_price ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination total={total} pageSize={PAGE_SIZE} page={page} />
        </Card>
      )}
    </div>
  );
}
