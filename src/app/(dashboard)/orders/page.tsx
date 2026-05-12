import Link from "next/link";
import { Plus, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { listMarketplaceOrders } from "@/lib/api/marketplace";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await listMarketplaceOrders();
  return (
    <div>
      <PageHeader
        title="Marketplace orders"
        description="Orders placed by residents through the service marketplace."
        actions={
          <Button asChild>
            <Link href="/orders/new"><Plus className="h-4 w-4" />New order</Link>
          </Button>
        }
      />
      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders yet"
          description="Orders will appear here as residents place them."
          action={<Button asChild><Link href="/orders/new">New order</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/orders/${o.id}`} className="hover:underline">{o.order_number}</Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                  <TableCell><StatusBadge status={o.order_status} /></TableCell>
                  <TableCell><StatusBadge status={o.payment_status} /></TableCell>
                  <TableCell>{formatCurrency(o.total_amount, { currency: o.currency })}</TableCell>
                  <TableCell className="text-muted-foreground">{formatCurrency(o.commission_amount, { currency: o.currency })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
