import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderActionsRow } from "@/components/marketplace/order-actions-row";
import {
  getMarketplaceOrder, getMarketplaceOrderItems, getServiceProvider,
} from "@/lib/api/marketplace";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getMarketplaceOrder(id);
  if (!order) notFound();
  const [items, provider] = await Promise.all([
    getMarketplaceOrderItems(id),
    getServiceProvider(order.provider_id),
  ]);

  return (
    <div>
      <PageHeader
        title={`Order ${order.order_number}`}
        description={`Placed ${new Date(order.created_at).toLocaleString()}`}
        actions={<OrderActionsRow orderId={id} status={order.order_status} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Status</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Order: <StatusBadge status={order.order_status} /></div>
            <div>Payment: <StatusBadge status={order.payment_status} /></div>
            {order.cancellation_reason && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">Cancellation reason</p>
                <p>{order.cancellation_reason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Provider</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {provider ? (
              <Link href={`/service-providers/${provider.id}`} className="hover:underline">
                <p className="font-medium">{provider.provider_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{provider.provider_kind.replace("_", " ")}</p>
              </Link>
            ) : "—"}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit price</TableHead>
                <TableHead className="text-right">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.item_name}</TableCell>
                  <TableCell>{i.quantity}</TableCell>
                  <TableCell>{formatCurrency(i.unit_price, { currency: order.currency })}</TableCell>
                  <TableCell className="text-right">{formatCurrency(i.line_total, { currency: order.currency })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6 max-w-md ml-auto">
        <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(order.subtotal, { currency: order.currency })}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Service fee</span><span>{formatCurrency(order.service_fee, { currency: order.currency })}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{formatCurrency(order.delivery_fee, { currency: order.currency })}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatCurrency(order.tax_amount, { currency: order.currency })}</span></div>
          <div className="flex justify-between border-t pt-2 font-semibold"><span>Total</span><span>{formatCurrency(order.total_amount, { currency: order.currency })}</span></div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>Commission</span><span>{formatCurrency(order.commission_amount, { currency: order.currency })}</span></div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>Provider net</span><span>{formatCurrency(order.provider_net, { currency: order.currency })}</span></div>
        </CardContent>
      </Card>

      {(order.delivery_address || order.delivery_notes || order.notes) && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Delivery / notes</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {order.delivery_address && <div><span className="text-muted-foreground">Address:</span> {order.delivery_address}</div>}
            {order.delivery_notes && <div><span className="text-muted-foreground">Delivery notes:</span> {order.delivery_notes}</div>}
            {order.notes && <div><span className="text-muted-foreground">Notes:</span> {order.notes}</div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
