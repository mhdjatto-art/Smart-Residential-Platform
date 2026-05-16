import { notFound } from "next/navigation";
import { Home, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPayment, getReceiptForPayment, listAllocations } from "@/lib/api/payments";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/config/site";
import { formatCurrency, formatDate } from "@/lib/utils";
import { requireCapability } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability("payment:read");
  const { id } = await params;
  const [payment, receipt, allocations] = await Promise.all([
    getPayment(id),
    getReceiptForPayment(id),
    listAllocations(id),
  ]);
  if (!payment || !receipt) notFound();

  const supabase = await createClient();
  const [orgRes, contractRes, residentRes, unitRes, compoundRes, instRes] = await Promise.all([
    supabase.from("organizations").select("name, contact_email, contact_phone").eq("id", payment.organization_id).maybeSingle(),
    supabase.from("installment_contracts").select("contract_number, contract_type").eq("id", payment.contract_id).maybeSingle(),
    supabase.from("residents").select("first_name, last_name, email, mobile, national_id").eq("id", payment.resident_id).maybeSingle(),
    supabase.from("units").select("unit_number, building_id").eq("id", (await supabase.from("installment_contracts").select("unit_id").eq("id", payment.contract_id).single()).data!.unit_id!).maybeSingle(),
    supabase.from("compounds").select("name, city").eq("id", payment.compound_id).maybeSingle(),
    supabase.from("installment_schedules").select("id, installment_number, due_date").eq("contract_id", payment.contract_id),
  ]);

  const org = orgRes.data as { name?: string; contact_email?: string; contact_phone?: string } | null;
  const contract = contractRes.data as { contract_number?: string; contract_type?: string } | null;
  const resident = residentRes.data as { first_name?: string; last_name?: string; email?: string; mobile?: string; national_id?: string } | null;
  const unit = unitRes.data as { unit_number?: string } | null;
  const compound = compoundRes.data as { name?: string; city?: string } | null;

  const installmentMap = new Map<string, { number: number; due_date: string }>();
  for (const row of (instRes.data ?? []) as unknown as Array<{ id: string; installment_number: number; due_date: string }>) {
    installmentMap.set(row.id, { number: row.installment_number, due_date: row.due_date });
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6 print:bg-white print:p-0">
      {/* Toolbar (hidden in print) */}
      <div className="mx-auto max-w-3xl mb-4 flex items-center justify-between print:hidden">
        <Button asChild variant="outline" size="sm">
          <a href="javascript:history.back()"><Home className="h-4 w-4" />Back</a>
        </Button>
        <Button size="sm" onClick={undefined} asChild>
          <a href="javascript:window.print()"><Printer className="h-4 w-4" />Print / Save PDF</a>
        </Button>
      </div>

      {/* Receipt body */}
      <div className="mx-auto max-w-3xl rounded-xl border bg-white p-10 shadow-sm print:border-0 print:shadow-none print:rounded-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{siteConfig.name}</p>
            <h1 className="mt-1 text-2xl font-bold">{org?.name ?? "Organization"}</h1>
            {compound?.name && <p className="text-sm text-muted-foreground">{compound.name}{compound.city ? `, ${compound.city}` : ""}</p>}
            {org?.contact_email && <p className="text-xs text-muted-foreground">{org.contact_email}{org.contact_phone ? ` · ${org.contact_phone}` : ""}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Receipt</p>
            <p className="font-mono text-lg font-bold">{receipt.receipt_number}</p>
            <p className="text-xs text-muted-foreground">Issued {formatDate(receipt.issued_at)}</p>
          </div>
        </div>

        {/* Parties */}
        <div className="mt-6 grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Received from</p>
            <p className="mt-2 font-semibold">{resident?.first_name} {resident?.last_name}</p>
            {resident?.national_id && <p className="text-xs">ID: {resident.national_id}</p>}
            {resident?.email && <p className="text-xs text-muted-foreground">{resident.email}</p>}
            {resident?.mobile && <p className="text-xs text-muted-foreground">{resident.mobile}</p>}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contract</p>
            <p className="mt-2 font-semibold font-mono">{contract?.contract_number}</p>
            <p className="text-xs capitalize text-muted-foreground">{contract?.contract_type?.replace(/_/g, " ")}</p>
            <p className="text-xs">Unit: <span className="font-mono">{unit?.unit_number ?? "—"}</span></p>
          </div>
        </div>

        {/* Allocations */}
        <div className="mt-8">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Allocated to</p>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-medium">Installment</th>
                <th className="py-2 text-left font-medium">Due date</th>
                <th className="py-2 text-left font-medium">Applied to</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => {
                const inst = installmentMap.get(a.installment_id);
                return (
                  <tr key={a.id} className="border-b">
                    <td className="py-2">#{inst?.number ?? "—"}</td>
                    <td className="py-2 text-muted-foreground">{formatDate(inst?.due_date ?? null)}</td>
                    <td className="py-2 capitalize">{a.applied_to}</td>
                    <td className="py-2 text-right tabular-nums">{formatCurrency(a.amount, { currency: payment.currency ?? "IQD" })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-8 ml-auto w-64 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Method</span>
            <span className="capitalize">{payment.payment_method.replace("_", " ")}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Payment date</span>
            <span>{formatDate(payment.payment_date)}</span>
          </div>
          {payment.external_reference && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-mono">{payment.external_reference}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-3 text-base font-bold">
            <span>Total received</span>
            <span className="tabular-nums">{formatCurrency(payment.payment_amount, { currency: payment.currency ?? "IQD" })}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 grid grid-cols-2 gap-8 border-t pt-6 text-xs text-muted-foreground">
          <div>
            <p>Payment reference: <span className="font-mono">{payment.payment_reference}</span></p>
            <p className="mt-1">Status: <span className="capitalize">{payment.payment_status}</span></p>
            {payment.payment_status === "reversed" && (
              <p className="mt-1 font-bold text-destructive">REVERSED · {formatDate(payment.reversed_at)}</p>
            )}
          </div>
          <div className="text-right">
            <div className="ml-auto h-16 w-16 rounded border bg-muted/40 flex items-center justify-center text-[10px]">
              QR
            </div>
            <p className="mt-2">Scan to verify</p>
          </div>
        </div>
      </div>
    </div>
  );
}
