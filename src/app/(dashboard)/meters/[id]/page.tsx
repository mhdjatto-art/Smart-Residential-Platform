import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gauge } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ReadingForm, GenerateBillButton } from "@/components/meters/reading-form";
import { getMeter, listReadings } from "@/lib/api/utilities";
import { formatDate } from "@/lib/utils";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function MeterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability("utility:read");
  const { id } = await params;
  const meter = await getMeter(id);
  if (!meter) notFound();
  const readings = await listReadings(id);

  return (
    <div>
      <PageHeader
        title={`Meter ${meter.meter_number}`}
        description={`Current ${meter.current_reading.toFixed(2)} ${meter.unit_of_measure} · ${meter.smart_enabled ? "Smart" : "Manual"}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/meters"><ArrowLeft className="h-4 w-4" />Back</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gauge className="h-4 w-4" />Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Brand" value={meter.brand ?? "—"} />
            <Field label="Model" value={meter.model ?? "—"} />
            <Field label="Serial" value={<span className="font-mono text-xs">{meter.serial_number ?? "—"}</span>} />
            <Field label="Installed" value={formatDate(meter.installed_at)} />
            <Field label="Status" value={<StatusBadge status={meter.status} />} />
            <Field label="Adapter" value={meter.adapter_kind ?? "manual"} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Readings ({readings.length})</CardTitle>
            <ReadingForm meterId={meter.id} currentReading={meter.current_reading} />
          </CardHeader>
          <CardContent className="p-0">
            {readings.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No readings yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Previous</TableHead>
                    <TableHead className="text-right">Reading</TableHead>
                    <TableHead className="text-right">Consumption</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Bill</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readings.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground">{formatDate(r.reading_date)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.previous_reading.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.reading_value.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{r.consumption.toFixed(2)}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{r.source.replace("_", " ")}</TableCell>
                      <TableCell className="text-right">
                        <GenerateBillButton readingId={r.id} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
