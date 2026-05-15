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
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await listMarketplaceOrders();
  const { t } = await getT();
  return (
    <div>
      <PageHeader
        titleKey="headers.orders_title"
        descKey="headers.orders_desc"
        actions={
          <Button asChild>
            <Link href="/orders/new"><Plus className="h-4 w-4" />{t("ops.orders_new")}</Link>
          </Button>
        }
      />
      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={t("ops.orders_empty_title")}
          description={t("ops.orders_empty_desc")}
          action={<Button asChild><Link href="/orders/new">{t("ops.orders_new")}</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("ops.orders_order_number")}</TableHead>
                <TableHead>{t("tables.date")}</TableHead>
                <TableHead>{t("tables.status")}</TableHead>
                <TableHead>{t("ops.orders_payment")}</TableHead>
                <TableHead>{t("ops.orders_total")}</TableHead>
                <TableHead>{t("ops.orders_commission")}</TableHead>
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
