import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { listAccountMappings, listErpIntegrations } from "@/lib/api/erp";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AccountMappingsPage() {
  await requireCapability("erp:read");
  const [integrations, mappings] = await Promise.all([listErpIntegrations(), listAccountMappings()]);
  const integrationName = new Map(integrations.map((i) => [i.id, i.name]));

  return (
    <div>
      <PageHeader
        title="Account mappings"
        description="Map SRP business events (installment revenue, cash, penalties, …) to GL accounts in your ERP."
      />
      {mappings.length === 0 ? (
        <EmptyState
          icon={ArrowRight}
          title="No mappings yet"
          description="Add at least one mapping for 'cash_account' and one for 'installment_revenue' to enable auto-push."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Integration</TableHead>
                <TableHead>SRP Event</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>GL Account (external id)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs font-medium">{integrationName.get(m.integration_id) ?? m.integration_id.slice(0,8)}</TableCell>
                  <TableCell className="text-xs font-mono">{m.mapping_kind}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {[m.compound_id ? "compound" : null, m.currency, m.payment_method].filter(Boolean).join(" · ") || "(default)"}
                  </TableCell>
                  <TableCell className="font-mono">{m.gl_account_external_id}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
