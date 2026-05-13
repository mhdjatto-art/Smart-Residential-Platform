import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { ReceiptActions } from "@/components/mobile/receipt-actions";
import { getReceipt } from "@/lib/api/receipts";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Receipt" };
export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: Promise<{ bill_id: string }> }) {
  const { bill_id } = await params;
  const r = await getReceipt(bill_id);
  if (!r) notFound();

  const paidPretty = r.bill.paid_at ? new Date(r.bill.paid_at).toLocaleString() : "—";
  const lastPayment = (r.bill.metadata?.last_payment ?? null) as
    | { amount?: number; method?: string; reference?: string; at?: string }
    | null;

  return (
    <div className="mx-auto max-w-2xl p-4 print:p-0">
      {/* Top actions — hidden on print */}
      <div className="mb-4 flex justify-end">
        <ReceiptActions />
      </div>

      {/* Receipt document */}
      <div className="rounded-lg border bg-white p-8 text-slate-900 shadow-sm print:rounded-none print:border-0 print:shadow-none dark:bg-white">
        {/* Header */}
        <header className="border-b border-slate-200 pb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Payment receipt</p>
              <h1 className="mt-1 text-2xl font-bold">{r.organization.name}</h1>
              {r.compound?.name && (
                <p className="text-sm text-slate-600">
                  {r.compound.name}{r.compound.city ? ` · ${r.compound.city}` : ""}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                {[r.organization.contact_email, r.organization.contact_phone].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> {r.bill.status === "paid" ? "PAID" : r.bill.status.toUpperCase()}
              </div>
              <p className="mt-2 text-xs text-slate-500">Receipt #</p>
              <p className="font-mono text-sm font-semibold">{r.bill.bill_number}</p>
            </div>
          </div>
        </header>

        {/* Bill-to / Service */}
        <section className="grid grid-cols-1 gap-6 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Billed to</p>
            <p className="mt-1 text-base font-semibold">{r.resident?.full_name ?? "Resident"}</p>
            {r.unit && (
              <p className="text-sm text-slate-600">
                {r.unit.building_name ? `${r.unit.building_name} · ` : ""}{r.unit.unit_number}
              </p>
            )}
            {r.resident?.email && <p className="text-xs text-slate-500">{r.resident.email}</p>}
            {r.resident?.phone && <p className="text-xs text-slate-500">{r.resident.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">Service</p>
            <p className="mt-1 text-base font-semibold capitalize">{r.bill.utility_type}</p>
            {r.provider?.provider_name && (
              <p className="text-sm text-slate-600">{r.provider.provider_name}</p>
            )}
            <p className="text-xs text-slate-500">
              Period: {formatDate(r.bill.billing_period_start)} → {formatDate(r.bill.billing_period_end)}
            </p>
            <p className="text-xs text-slate-500">Due date: {formatDate(r.bill.due_date)}</p>
          </div>
        </section>

        {/* Amounts table */}
        <section className="border-t border-slate-200 py-6">
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1 text-slate-600">Subtotal</td>
                <td className="py-1 text-right tabular-nums">{formatCurrency(r.bill.subtotal, { currency: r.bill.currency })}</td>
              </tr>
              <tr>
                <td className="py-1 text-slate-600">Tax</td>
                <td className="py-1 text-right tabular-nums">{formatCurrency(r.bill.tax_amount, { currency: r.bill.currency })}</td>
              </tr>
              {r.bill.penalty_amount > 0 && (
                <tr>
                  <td className="py-1 text-amber-700">Late penalty</td>
                  <td className="py-1 text-right tabular-nums text-amber-700">
                    {formatCurrency(r.bill.penalty_amount, { currency: r.bill.currency })}
                  </td>
                </tr>
              )}
              <tr className="border-t border-slate-200">
                <td className="py-2 font-semibold">Total</td>
                <td className="py-2 text-right text-base font-bold tabular-nums">
                  {formatCurrency(r.bill.total_amount + r.bill.penalty_amount, { currency: r.bill.currency })}
                </td>
              </tr>
              <tr className="bg-emerald-50">
                <td className="py-2 font-semibold text-emerald-800">Paid</td>
                <td className="py-2 text-right text-base font-bold tabular-nums text-emerald-800">
                  {formatCurrency(r.bill.paid_amount, { currency: r.bill.currency })}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Payment details */}
        <section className="border-t border-slate-200 pt-6">
          <p className="text-xs uppercase tracking-wide text-slate-500">Payment details</p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-600">Paid at</dt>
            <dd className="text-right tabular-nums">{paidPretty}</dd>
            {lastPayment?.method && (
              <>
                <dt className="text-slate-600">Method</dt>
                <dd className="text-right capitalize">{String(lastPayment.method).replace(/_/g, " ")}</dd>
              </>
            )}
            {lastPayment?.reference && (
              <>
                <dt className="text-slate-600">Reference</dt>
                <dd className="text-right font-mono text-xs">{lastPayment.reference}</dd>
              </>
            )}
          </dl>
        </section>

        {/* Footer */}
        <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-[10px] text-slate-400">
          This is an electronically-generated receipt and is valid without a signature.
          <br />
          Generated on {new Date().toLocaleString()} · SRP Platform
        </footer>
      </div>
    </div>
  );
}
