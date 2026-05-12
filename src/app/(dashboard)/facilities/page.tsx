import Link from "next/link";
import { Building, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { listFacilities } from "@/lib/api/facilities";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FacilitiesPage() {
  const facilities = await listFacilities();

  return (
    <div>
      <PageHeader
        title="Facilities"
        description="Bookable amenities: gyms, pools, meeting rooms, halls."
        actions={
          <Button asChild>
            <Link href="/facilities/new"><Plus className="h-4 w-4" />Add facility</Link>
          </Button>
        }
      />

      {facilities.length === 0 ? (
        <EmptyState
          icon={Building}
          title="No facilities yet"
          description="Add facilities so residents can book them."
          action={<Button asChild><Link href="/facilities/new">Add facility</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Min / Max duration</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilities.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{f.facility_type.replace("_", " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{f.capacity ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{f.min_duration_minutes} / {f.max_duration_minutes} min</TableCell>
                  <TableCell>{f.requires_approval ? <Badge variant="warning">Required</Badge> : <Badge variant="success">Auto</Badge>}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(f.booking_fee, { currency: f.fee_currency ?? "USD" })}</TableCell>
                  <TableCell>{f.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Inactive</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
