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
import { getT } from "@/lib/i18n/server";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability("marketplace:read");
  const { id } = await params;
  const order = await getMarketplaceOrder(id);
  if (!order) notFound();
  const [items, provider] = await Promise.all([
    getMarketplaceOrderItems(id),
    getServiceProvider(order.provider_id),
  ]);
  const { t } = await getT();

  return (
    <div>
      <PageHeader
        title={t("ops.order_title", { number: order.order_number })}
        description={t("ops.order_placed_at", { date: new Date(order.created_at).toLocaleString() })}
        actions={<OrderActionsRow orderId={id} status={order.order_status} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>{t("ops.order_status_card")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>{t("ops.order_order_label")}: <StatusBadge status={order.order_status} /></div>
            <div>{t("ops.order_payment_label")}: <StatusBadge status={order.payment_status} /></div>
            {order.cancellation_reason && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">{t("ops.order_cancellation_reason")}</p>
                <p>{order.cancellation_reason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{t("ops.order_provider_card")}</CardTitle></CardHeader>
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
        <CardHeader><CardTitle>{t("ops.order_items_card")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("ops.order_item_col")}</TableHead>
                <TableHead>{t("ops.order_qty")}</TableHead>
                <TableHead>{t("ops.order_unit_price")}</TableHead>
                <TableHead className="text-right">{t("ops.order_line_total")}</TableHead>
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
        <CardHeader><CardTitle>{t("ops.order_totals_card")}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">{t("ops.order_subtotal")}</span><span>{formatCurrency(order.subtotal, { currency: order.currency })}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("ops.order_service_fee")}</span><span>{formatCurrency(order.service_fee, { currency: order.currency })}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("ops.order_delivery")}</span><span>{formatCurrency(order.delivery_fee, { currency: order.currency })}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("ops.order_tax")}</span><span>{formatCurrency(order.tax_amount, { currency: order.currency })}</span></div>
          <div className="flex justify-between border-t pt-2 font-semibold"><span>{t("ops.order_total")}</span><span>{formatCurrency(order.total_amount, { currency: order.currency })}</span></div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>{t("ops.order_commission")}</span><span>{formatCurrency(order.commission_amount, { currency: order.currency })}</span></div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>{t("ops.order_provider_net")}</span><span>{formatCurrency(order.provider_net, { currency: order.currency })}</span></div>
        </CardContent>
      </Card>

      {(order.delivery_address || order.delivery_notes || order.notes) && (
        <Card className="mt-6">
          <CardHeader><CardTitle>{t("ops.order_delivery_notes_card")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {order.delivery_address && <div><span className="text-muted-foreground">{t("ops.order_address_label")}</span> {order.delivery_address}</div>}
            {order.delivery_notes && <div><span className="text-muted-foreground">{t("ops.order_delivery_notes_label")}</span> {order.delivery_notes}</div>}
            {order.notes && <div><span className="text-muted-foreground">{t("ops.order_notes_label")}</span> {order.notes}</div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
