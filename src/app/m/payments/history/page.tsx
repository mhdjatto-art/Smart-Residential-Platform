import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Receipt } from "lucide-react";
import { MobileTopbar } from "@/components/mobile/topbar";
import { Button } from "@/components/ui/button";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { listMyPaidBills } from "@/lib/api/receipts";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Payment history" };
export const dynamic = "force-dynamic";

export default async function PaymentHistoryPage() {
  const ctx = await getResidentContext();
  const { t } = await getT();
  const bills = await listMyPaidBills();

  return (
    <div>
      <MobileTopbar title={t("mobile.payment_history") || "Payment history"} userId={ctx.user_id} unread={0} showBack />

      <div className="p-4">
        {bills.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <Receipt className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No paid bills yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {bills.map((b) => (
              <li key={b.id} className="rounded-xl border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize">{b.utility_type}</p>
                    <p className="truncate text-xs text-muted-foreground font-mono">{b.bill_number}</p>
                    {b.provider_name && (
                      <p className="truncate text-xs text-muted-foreground">{b.provider_name}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(b.total_amount, { currency: b.currency })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {b.paid_at ? new Date(b.paid_at).toLocaleDateString() : "—"}
                    </p>
                    <Button asChild size="sm" variant="outline" className="h-7 px-2">
                      <Link href={`/m/payments/${b.id}/receipt`}>
                        <FileText className="h-3 w-3" /> Receipt
                      </Link>
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
