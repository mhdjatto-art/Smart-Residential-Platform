import Link from "next/link";
import { Gauge, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { listMeters } from "@/lib/api/utilities";

export const dynamic = "force-dynamic";

export default async function MetersPage() {
  const meters = await listMeters();
  return (
    <div>
      <PageHeader
        title="Electricity meters"
        description="Manage meters, record readings, and generate consumption bills."
        actions={<Button asChild><Link href="/meters/new"><Plus className="h-4 w-4" />Add meter</Link></Button>}
      />
      {meters.length === 0 ? (
        <EmptyState icon={Gauge} title="No meters" description="Register electricity meters to start tracking consumption."
          action={<Button asChild><Link href="/meters/new">Add meter</Link></Button>} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Brand/Model</TableHead>
                <TableHead className="text-right">Current reading</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Smart</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meters.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link href={`/meters/${m.id}`} className="font-mono font-medium hover:underline">{m.meter_number}</Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.brand ?? "—"}{m.model ? ` / ${m.model}` : ""}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{m.current_reading.toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground">{m.unit_of_measure}</TableCell>
                  <TableCell>{m.smart_enabled ? <Badge variant="success">Smart</Badge> : <Badge variant="muted">Manual</Badge>}</TableCell>
                  <TableCell><StatusBadge status={m.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
