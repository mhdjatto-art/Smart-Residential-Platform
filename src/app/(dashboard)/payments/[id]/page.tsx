import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ReverseButton } from "@/components/payments/reverse-button";
import { getPayment, getReceiptForPayment, listAllocations } from "@/lib/api/payments";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability("payment:read");
  const { id } = await params;
  const payment = await getPayment(id);
  if (!payment) notFound();

  const supabase = await createClient();
  const [receipt, allocations, contract, instData] = await Promise.all([
    getReceiptForPayment(id),
    listAllocations(id),
    supabase.from("installment_contracts").select("id, contract_number").eq("id", payment.contract_id).maybeSingle(),
    supabase.from("installment_schedules").select("id, installment_number, due_date").eq("contract_id", payment.contract_id),
  ]);

  const installmentMap = new Map<string, { number: number; due_date: string }>();
  for (const row of (instData.data ?? []) as unknown as Array<{ id: string; installment_number: number; due_date: string }>) {
    installmentMap.set(row.id, { number: row.installment_number, due_date: row.due_date });
  }

  return (
    <div>
      <PageHeader
        title={payment.payment_reference}
        description={`${formatCurrency(payment.payment_amount, { currency: payment.currency ?? "USD" })} · ${payment.payment_method.replace("_", " ")} · ${formatDate(payment.payment_date)}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/payments"><ArrowLeft className="h-4 w-4" />Back</Link>
            </Button>
            {receipt && (
              <Button asChild>
                <Link href={`/payments/${payment.id}/receipt`} target="_blank">
                  <Receipt className="h-4 w-4" />View receipt
                </Link>
              </Button>
            )}
            {payment.payment_status === "confirmed" && <ReverseButton paymentId={payment.id} />}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Allocations</CardTitle></CardHeader>
          <CardContent className="p-0">
            {allocations.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No allocations.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Installment</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead>Applied to</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((a) => {
                    const inst = installmentMap.get(a.installment_id);
                    return (
                      <TableRow key={a.id}>
                        <TableCell>#{inst?.number ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(inst?.due_date ?? null)}</TableCell>
                        <TableCell className="capitalize">{a.applied_to}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatCurrency(a.amount, { currency: payment.currency ?? "USD" })}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Status" value={<StatusBadge status={payment.payment_status} />} />
            <Row label="Amount" value={<span className="font-medium">{formatCurrency(payment.payment_amount, { currency: payment.currency ?? "USD" })}</span>} />
            <Row label="Method" value={<span className="capitalize">{payment.payment_method.replace("_", " ")}</span>} />
            <Row label="Date" value={formatDate(payment.payment_date)} />
            <Row label="Receipt" value={receipt ? <Link className="font-mono hover:underline" href={`/payments/${payment.id}/receipt`}>{receipt.receipt_number}</Link> : "—"} />
            <Row label="Contract" value={
              <Link href={`/contracts/${payment.contract_id}`} className="hover:underline">
                {(contract.data as { contract_number?: string } | null)?.contract_number ?? "—"}
              </Link>
            } />
            <Row label="External ref" value={<span className="font-mono text-xs">{payment.external_reference ?? "—"}</span>} />
            {payment.notes && <Row label="Notes" value={payment.notes} />}
            {payment.payment_status === "reversed" && (
              <>
                <Row label="Reversed at" value={formatDate(payment.reversed_at)} />
                <Row label="Reason" value={payment.reversal_reason ?? "—"} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
