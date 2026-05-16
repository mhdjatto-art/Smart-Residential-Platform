import { BadgePercent } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PayoutRow {
  id: string;
  provider_id: string;
  provider_name: string | null;
  period_start: string;
  period_end: string;
  total_orders: number;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
}

export default async function PayoutsPage() {
  await requireRole(["super_admin","developer_admin","compound_manager","finance_officer"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("provider_payouts")
    .select("id,provider_id,period_start,period_end,total_orders,gross_amount,commission_amount,net_amount,currency,status,paid_at,provider:service_providers(provider_name)")
    .order("period_end", { ascending: false })
    .limit(200);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payouts: PayoutRow[] = ((data ?? []) as any[]).map((p) => ({
    id: p.id,
    provider_id: p.provider_id,
    provider_name: p.provider?.provider_name ?? null,
    period_start: p.period_start,
    period_end: p.period_end,
    total_orders: p.total_orders ?? 0,
    gross_amount: Number(p.gross_amount ?? 0),
    commission_amount: Number(p.commission_amount ?? 0),
    net_amount: Number(p.net_amount ?? 0),
    currency: p.currency ?? "USD",
    status: p.status,
    paid_at: p.paid_at,
  }));

  return (
    <div>
      <PageHeader
        title="Provider payouts"
        description="What providers are owed after commission. Compute payouts per period from the SaaS console."
      />
      {payouts.length === 0 ? (
        <EmptyState
          icon={BadgePercent}
          title="No payouts computed yet"
          description="Use compute_provider_payout(provider_id, period_start, period_end) from SQL or wire an automation rule to roll up completed orders."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Net (payable)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.provider_name ?? p.provider_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(p.period_start).toLocaleDateString()} → {new Date(p.period_end).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.total_orders}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(p.gross_amount, { currency: p.currency })}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(p.commission_amount, { currency: p.currency })}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(p.net_amount, { currency: p.currency })}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
