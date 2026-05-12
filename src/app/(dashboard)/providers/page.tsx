import Link from "next/link";
import { Plug, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { listProviders } from "@/lib/api/utilities";

export const dynamic = "force-dynamic";

export default async function ProvidersPage() {
  const providers = await listProviders();
  return (
    <div>
      <PageHeader
        title="Utility providers"
        description="Electricity, internet, gas, water, generator, and maintenance providers."
        actions={<Button asChild><Link href="/providers/new"><Plus className="h-4 w-4" />Add provider</Link></Button>}
      />
      {providers.length === 0 ? (
        <EmptyState icon={Plug} title="No providers yet" description="Add a utility provider to start managing services."
          action={<Button asChild><Link href="/providers/new">Add provider</Link></Button>} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Adapter</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.provider_name}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{p.provider_type}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.provider_code ?? "—"}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{p.billing_method.replace("_", " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{p.adapter_kind ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={p.provider_status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
