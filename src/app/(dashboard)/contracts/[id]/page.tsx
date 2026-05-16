import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, DollarSign, Download, FileText, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ContractActions } from "@/components/contracts/contract-actions";
import { getContract, listSchedule } from "@/lib/api/contracts";
import { listPaymentsPaged } from "@/lib/api/payments";
import { getLatestSignature } from "@/lib/api/contract-signatures";
import { ActivityTimeline } from "@/components/audit/activity-timeline";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability("contract:read");
  const { id } = await params;
  const contract = await getContract(id);
  if (!contract) notFound();
  const { t } = await getT();

  const supabase = await createClient();
  const [schedule, paymentsResult, unitRes, residentRes, orgRes, signature] = await Promise.all([
    listSchedule(id),
    listPaymentsPaged({ contractId: id, pageSize: 50 }),
    supabase.from("units").select("id, unit_number").eq("id", contract.unit_id).maybeSingle(),
    supabase.from("residents").select("id, first_name, last_name").eq("id", contract.resident_id).maybeSingle(),
    supabase.from("organizations").select("currency").eq("id", contract.organization_id).maybeSingle(),
    getLatestSignature(id),
  ]);

  const unitNumber = (unitRes.data as { unit_number?: string } | null)?.unit_number ?? "—";
  const residentRow = residentRes.data as { first_name?: string; last_name?: string } | null;
  const residentName = residentRow ? `${residentRow.first_name ?? ""} ${residentRow.last_name ?? ""}`.trim() : "—";
  const orgCurrency = (orgRes.data as { currency?: string } | null)?.currency ?? "IQD";
  // Effective currency: contract override → org default → USD
  const cur = contract.currency ?? orgCurrency;
  const fmt = (n: number | null | undefined) => formatCurrency(n, { currency: cur });

  const outstanding = schedule.reduce(
    (sum, s) => sum + (Number(s.total_due) + Number(s.penalty_amount) - Number(s.paid_amount)),
    0,
  );
  const paidTotal = schedule.reduce((sum, s) => sum + Number(s.paid_amount), 0);
  const nextDue = schedule.find((s) => s.status !== "paid" && s.status !== "cancelled");

  // Translate contract type if a known key exists, else fall back to humanized form.
  const contractTypeKey = `contract_types.${contract.contract_type}` as Parameters<typeof t>[0];
  const contractTypeOut = t(contractTypeKey);
  const contractTypeLabel = contractTypeOut === contractTypeKey
    ? contract.contract_type.replace(/_/g, " ")
    : contractTypeOut;

  return (
    <div>
      <PageHeader
        title={contract.contract_number}
        description={t("details.contract_subtitle", {
          type: contractTypeLabel,
          currency: cur,
          unit: unitNumber,
          resident: residentName,
        })}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/contracts"><ArrowLeft className="h-4 w-4" />{t("actions.back")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/contracts/${contract.id}/print`}>
                <Printer className="h-4 w-4" />{t("actions.print_contract")}
              </Link>
            </Button>
            {schedule.length > 0 && (
              <Button asChild variant="outline">
                <Link href={`/api/exports/schedules.csv?contract=${contract.id}`}>
                  <Download className="h-4 w-4" />{t("actions.export_schedule")}
                </Link>
              </Button>
            )}
            {(contract.contract_status === "active" || contract.contract_status === "completed") && (
              <Button asChild>
                <Link href={`/payments/new?contract=${contract.id}`}>
                  <DollarSign className="h-4 w-4" />{t("actions.record_payment")}
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("details.total_price")} value={fmt(contract.total_property_price)} />
        <StatCard label={t("details.financed")} value={fmt(contract.financed_amount)} />
        <StatCard label={t("details.paid_to_date")} value={fmt(paidTotal)} />
        <StatCard label={t("details.outstanding")} value={fmt(outstanding)} />
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("headers.contract_short")}</CardTitle>
              <p className="text-xs text-muted-foreground capitalize mt-1">
                <StatusBadge status={contract.contract_status} /> · {t("details.installments_summary", {
                  count: contract.installment_count,
                  freq: contract.installment_frequency,
                  amount: fmt(contract.monthly_amount),
                })}
              </p>
            </div>
            <ContractActions
              contractId={contract.id}
              status={contract.contract_status}
              hasSchedule={schedule.length > 0}
            />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <Field label={t("details.currency")} value={cur} />
            <Field label={t("details.start_date")} value={formatDate(contract.contract_start_date)} />
            <Field label={t("details.end_date")} value={formatDate(contract.contract_end_date)} />
            <Field label={t("details.down_payment")} value={fmt(contract.down_payment)} />
            <Field label={t("details.interest_rate")} value={`${contract.annual_interest_rate}%`} />
            <Field label={t("details.frequency")} value={contract.installment_frequency} />
            <Field label={t("details.penalty_type")} value={contract.late_penalty_type ?? "—"} />
            <Field label={t("details.grace_period")} value={t("details.grace_period_days", { days: contract.grace_period_days })} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" />{t("headers.payment_schedule_title")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {schedule.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                {t("headers.no_schedule_generated")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{t("tables.due_date")}</TableHead>
                    <TableHead className="text-right">{t("tables.principal")}</TableHead>
                    <TableHead className="text-right">{t("tables.interest")}</TableHead>
                    <TableHead className="text-right">{t("tables.penalty")}</TableHead>
                    <TableHead className="text-right">{t("tables.total")}</TableHead>
                    <TableHead className="text-right">{t("tables.paid")}</TableHead>
                    <TableHead>{t("tables.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.installment_number}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(s.due_date)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(s.principal_amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(s.interest_amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(s.penalty_amount)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmt(Number(s.total_due) + Number(s.penalty_amount))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(s.paid_amount)}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("headers.payments_title_short")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {paymentsResult.data.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t("headers.no_payments_yet")}</p>
            ) : (
              <ul className="divide-y">
                {paymentsResult.data.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <Link href={`/payments/${p.id}`} className="font-medium hover:underline font-mono">
                        {p.payment_reference}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.payment_date)} · {p.payment_method.replace("_", " ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium tabular-nums">{fmt(p.payment_amount)}</p>
                      <StatusBadge status={p.payment_status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {signature && (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={signature.signature_png} alt="Signature" className="h-20 rounded border bg-white p-1" />
            <div className="text-sm">
              <p className="font-medium">{t("details.signed_by", { name: signature.full_name_typed ?? residentName })}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(signature.signed_at)} {signature.ip_address ? `· ${signature.ip_address}` : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {nextDue && (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
          <p className="text-sm">
            <strong>{t("details.next_due_label")}</strong> {formatDate(nextDue.due_date)} —{" "}
            {fmt(Number(nextDue.total_due) + Number(nextDue.penalty_amount) - Number(nextDue.paid_amount))}
          </p>
        </div>
      )}

      <div className="mt-6">
        <ActivityTimeline table="installment_contracts" rowId={contract.id} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
