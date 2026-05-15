import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getServiceProvider, listServiceItems, listReviews } from "@/lib/api/marketplace";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function ServiceProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = await getServiceProvider(id);
  if (!provider) notFound();
  const [items, reviews] = await Promise.all([listServiceItems({ provider_id: id }), listReviews({ provider_id: id })]);
  const { t } = await getT();

  return (
    <div>
      <PageHeader
        title={provider.provider_name}
        description={t("ops.provider_subtitle", { kind: provider.provider_kind.replace("_", " "), address: provider.address ?? t("ops.provider_no_address") })}
        actions={
          <Button asChild>
            <Link href={`/service-providers/${id}/items/new`}><Plus className="h-4 w-4" />{t("ops.provider_add_item")}</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>{t("ops.provider_profile_title")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 fill-amber-400 stroke-amber-500" />
              <span className="font-medium">{provider.rating_avg.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground">{t("ops.provider_rating_count", { n: provider.rating_count })}</span>
            </div>
            <div>{t("ops.provider_verification")}: <StatusBadge status={provider.verification_status} /></div>
            <div>{t("ops.provider_availability")}: <StatusBadge status={provider.availability_status} /></div>
            <div>{t("ops.provider_active")}: <StatusBadge status={provider.is_active ? "active" : "inactive"} /></div>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">{t("ops.provider_commission")}</p>
              <p className="font-mono">
                {provider.default_commission_kind === "percentage"
                  ? `${provider.default_commission_value}%`
                  : `${provider.default_commission_value} flat`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{t("ops.provider_contact_title")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {provider.mobile && <div>{t("ops.provider_phone_label")}: <span className="font-mono">{provider.mobile}</span></div>}
            {provider.email && <div>{t("ops.provider_email_label")}: <span className="font-mono">{provider.email}</span></div>}
            {provider.website && <div>{t("ops.provider_web_label")}: <span className="font-mono">{provider.website}</span></div>}
            {provider.description && <p className="text-muted-foreground pt-2 border-t">{provider.description}</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>{t("ops.provider_catalog_title")}</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("ops.provider_catalog_empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tables.name")}</TableHead>
                  <TableHead>{t("ops.provider_item_kind")}</TableHead>
                  <TableHead>{t("ops.provider_item_price")}</TableHead>
                  <TableHead>{t("ops.provider_item_unit")}</TableHead>
                  <TableHead>{t("tables.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{item.service_kind.replace("_", " ")}</TableCell>
                    <TableCell>{formatCurrency(item.price, { currency: item.currency })}</TableCell>
                    <TableCell className="text-muted-foreground">{item.unit ?? "—"}</TableCell>
                    <TableCell><StatusBadge status={item.is_active ? "active" : "inactive"} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>{t("ops.provider_reviews_title")}</CardTitle></CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("ops.provider_reviews_empty")}</p>
          ) : (
            <div className="space-y-3">
              {reviews.slice(0, 10).map((r) => (
                <div key={r.id} className="border rounded-md p-3 text-sm">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3 w-3 ${i < r.rating ? "fill-amber-400 stroke-amber-500" : "stroke-muted-foreground"}`} />
                    ))}
                    {r.title && <span className="ml-2 font-medium">{r.title}</span>}
                  </div>
                  {r.body && <p className="text-muted-foreground mt-1">{r.body}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
