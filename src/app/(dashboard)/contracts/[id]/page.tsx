import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, DollarSign, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ContractActions } from "@/components/contracts/contract-actions";
import { getContract, listSchedule } from "@/lib/api/contracts";
import { listPaymentsPaged } from "@/lib/api/payments";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contract = await getContract(id);
  if (!contract) notFound();

  const supabase = await createClient();
  const [schedule, paymentsResult, unitRes, residentRes, orgRes] = await Promise.all([
    listSchedule(id),
    listPaymentsPaged({ contractId: id, pageSize: 50 }),
    supabase.from("units").select("id, unit_number").eq("id", contract.unit_id).maybeSingle(),
    supabase.from("residents").select("id, first_name, last_name").eq("id", contract.resident_id).maybeSingle(),
    supabase.from("organizations").select("currency").eq("id", contract.organization_id).maybeSingle(),
  ]);

  const unitNumber = (unitRes.data as { unit_number?: string } | null)?.unit_number ?? "—";
  const residentRow = residentRes.data as { first_name?: string; last_name?: string } | null;
  const residentName = residentRow ? `${residentRow.first_name ?? ""} ${residentRow.last_name ?? ""}`.trim() : "—";
  const orgCurrency = (orgRes.data as { currency?: string } | null)?.currency ?? "USD";
  // Effective currency: contract override → org default → USD
  const cur = contract.currency ?? orgCurrency;
  const fmt = (n: number | null | undefined) => formatCurrency(n, { currency: cur });

  const outstanding = schedule.reduce(
    (sum, s) => sum + (Number(s.total_due) + Number(s.penalty_amount) - Number(s.paid_amount)),
    0,
  );
  const paidTotal = schedule.reduce((sum, s) => sum + Number(s.paid_amount), 0);
  const nextDue = schedule.find((s) => s.status !== "paid" && s.status !== "cancelled");

  return (
    <div>
      <PageHeader
        title={contract.contract_number}
        description={`${contract.contract_type.replace(/_/g, " ")} · ${cur} · Unit ${unitNumber} · ${residentName}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/contracts"><ArrowLeft className="h-4 w-4" />Back</Link>
            </Button>
            {(contract.contract_status === "active" || contract.contract_status === "completed") && (
              <Button asChild>
                <Link href={`/payments/new?contract=${contract.id}`}>
                  <DollarSign className="h-4 w-4" />Record payment
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total price" value={fmt(contract.total_property_price)} />
        <StatCard label="Financed" value={fmt(contract.financed_amount)} />
        <StatCard label="Paid to date" value={fmt(paidTotal)} />
        <StatCard label="Outstanding" value={fmt(outstanding)} />
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Contract</CardTitle>
              <p className="text-xs text-muted-foreground capitalize mt-1">
                <StatusBadge status={contract.contract_status} /> · {contract.installment_count} ×{" "}
                {contract.installment_frequency} at {fmt(contract.monthly_amount)}
              </p>
            </div>
            <ContractActions
              contractId={contract.id}
              status={contract.contract_status}
              hasSchedule={schedule.length > 0}
            />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <Field label="Currency" value={cur} />
            <Field label="Start date" value={formatDate(contract.contract_start_date)} />
            <Field label="End date" value={formatDate(contract.contract_end_date)} />
            <Field label="Down payment" value={fmt(contract.down_payment)} />
            <Field label="Interest rate" value={`${contract.annual_interest_rate}%`} />
            <Field label="Frequency" value={contract.installment_frequency} />
            <Field label="Penalty type" value={contract.late_penalty_type ?? "—"} />
            <Field label="Grace period" value={`${contract.grace_period_days} days`} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" />Payment schedule</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {schedule.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                No schedule generated. Click "Generate schedule" above to create it.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    <TableHead className="text-right">Penalty</TableHead>
                    <TableHead className="text-right">Total due</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Status</TableHead>
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
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {paymentsResult.data.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No payments yet.</p>
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

      {nextDue && (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
          <p className="text-sm">
            <strong>Next due:</strong> {formatDate(nextDue.due_date)} —{" "}
            {fmt(Number(nextDue.total_due) + Number(nextDue.penalty_amount) - Number(nextDue.paid_amount))}
          </p>
        </div>
      )}
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
