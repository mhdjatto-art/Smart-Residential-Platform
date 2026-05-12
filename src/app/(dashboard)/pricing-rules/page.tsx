import Link from "next/link";
import { Plus, Calculator } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { listPricingRules } from "@/lib/api/pricing";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PricingRulesPage() {
  const rules = await listPricingRules();
  return (
    <div>
      <PageHeader
        title="Pricing rules"
        titleKey="headers.pricing_rules_title"
        description="Dynamic service fees — by apartment size, consumption tiers, time-of-use, or custom formulas."
        descKey="headers.pricing_rules_desc"
        actions={<Button asChild><Link href="/pricing-rules/new"><Plus className="h-4 w-4" />New rule</Link></Button>}
      />
      {rules.length === 0 ? (
        <EmptyState
          icon={Calculator}
          title="No pricing rules yet"
          description="Create a rule to compute service fees dynamically (per sqm, tiered consumption, time-of-use, …)."
          action={<Button asChild><Link href="/pricing-rules/new">New rule</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Unit rate</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-xs capitalize text-muted-foreground">{r.service_kind}</TableCell>
                  <TableCell className="text-xs font-mono">{r.method}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.base_amount, { currency: r.currency })}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.unit_amount, { currency: r.currency })}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.priority}</TableCell>
                  <TableCell><StatusBadge status={r.is_active ? "active" : "inactive"} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
