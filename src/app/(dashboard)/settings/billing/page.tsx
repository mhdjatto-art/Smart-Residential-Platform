import { redirect } from "next/navigation";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole, requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface SubRow {
  plan_name: string | null;
  plan_code: string | null;
  status: string;
  billing_cycle: string;
  unit_price: number;
  currency: string;
  trial_ends_at: string | null;
  current_period_end: string;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  currency: string;
  due_date: string;
  paid_at: string | null;
}

export default async function BillingSettingsPage() {
  await requireRole(["super_admin","developer_admin","finance_officer"]);
  const user = await requireUser();
  const orgId = user.organizationIds[0];
  if (!orgId) redirect("/organizations");
  const { t } = await getT();

  const supabase = await createClient();
  const [{ data: subRaw }, { data: invRaw }] = await Promise.all([
    supabase.from("organization_subscriptions")
      .select("status,billing_cycle,unit_price,currency,trial_ends_at,current_period_end,plan:subscription_plans(code,name)")
      .eq("organization_id", orgId).maybeSingle(),
    supabase.from("saas_invoices")
      .select("id,invoice_number,status,total_amount,paid_amount,currency,due_date,paid_at")
      .eq("organization_id", orgId)
      .order("due_date", { ascending: false })
      .limit(50),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub: SubRow | null = subRaw ? { ...(subRaw as any), plan_name: (subRaw as any).plan?.name ?? null, plan_code: (subRaw as any).plan?.code ?? null } : null;
  const invoices = (invRaw ?? []) as unknown as InvoiceRow[];

  return (
    <div>
      <PageHeader
        titleKey="headers.billing_title"
        descKey="headers.billing_desc" />

      <Card>
        <CardHeader><CardTitle>{t("headers.subscription_title")}</CardTitle></CardHeader>
        <CardContent>
          {!sub ? (
            <p className="text-sm text-muted-foreground">{t("headers.no_active_subscription")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-4 text-sm">
              <div><p className="text-xs text-muted-foreground">{t("tables.plan")}</p><p className="font-medium">{sub.plan_name ?? sub.plan_code ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">{t("tables.status")}</p><p className="font-medium">{t(`status.${sub.status}` as TranslationKey)}</p></div>
              <div><p className="text-xs text-muted-foreground">{t("tables.billing_cycle")}</p><p className="font-medium capitalize">{sub.billing_cycle}</p></div>
              <div><p className="text-xs text-muted-foreground">{t("tables.price")}</p><p className="font-medium">{formatCurrency(sub.unit_price, { currency: sub.currency })}</p></div>
              <div className="sm:col-span-4 text-xs text-muted-foreground">
                {sub.status === "trialing" && sub.trial_ends_at && `${t("common.trial_ends", { date: new Date(sub.trial_ends_at).toLocaleDateString() })} · `}
                {t("common.next_renewal", { date: new Date(sub.current_period_end).toLocaleDateString() })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" />{t("headers.invoices_title")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("headers.no_invoices")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tables.invoice_number")}</TableHead>
                  <TableHead>{t("tables.due")}</TableHead>
                  <TableHead>{t("tables.total")}</TableHead>
                  <TableHead>{t("tables.outstanding")}</TableHead>
                  <TableHead>{t("tables.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                    <TableCell className="text-sm">{new Date(i.due_date).toLocaleDateString()}</TableCell>
                    <TableCell>{formatCurrency(i.total_amount, { currency: i.currency })}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(Math.max(0, i.total_amount - i.paid_amount), { currency: i.currency })}</TableCell>
                    <TableCell>{t(`status.${i.status}` as TranslationKey)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
