import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle, CheckCircle2, Ban } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { getWalletDetail } from "@/lib/api/wallets";
import { ActivityTimeline } from "@/components/audit/activity-timeline";
import { ManagerTopupButton } from "@/components/wallet/manager-topup-button";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Wallet" };
export const dynamic = "force-dynamic";

export default async function WalletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getWalletDetail(id);
  if (!detail) notFound();
  const { wallet, topups, deductions } = detail;
  const isLow = wallet.balance <= wallet.low_balance_threshold;
  const isZero = wallet.balance <= 0;

  return (
    <div>
      <PageHeader
        title={`Wallet · ${wallet.utility_type}`}
        description={`Resident ${wallet.resident_id.slice(0, 8)} · ${wallet.currency}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/wallets"><ArrowLeft className="h-4 w-4" />All wallets</Link>
            </Button>
            <ManagerTopupButton walletId={wallet.id} currency={wallet.currency} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          label="Current balance"
          value={formatCurrency(wallet.balance, { currency: wallet.currency })}
          tone={isZero ? "rose" : isLow ? "amber" : "emerald"}
        />
        <StatCard label="Threshold" value={formatCurrency(wallet.low_balance_threshold, { currency: wallet.currency })} />
        <StatCard label="Total topped up" value={formatCurrency(wallet.total_topped_up, { currency: wallet.currency })} />
        <StatCard label="Total consumed" value={formatCurrency(wallet.total_consumed, { currency: wallet.currency })} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top-ups */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
              Top-ups ({topups.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topups.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No top-ups yet.</p>
            ) : (
              <ul className="divide-y">
                {topups.map((t) => (
                  <li key={t.id} className="flex items-start justify-between p-3 text-sm hover:bg-muted/40">
                    <div>
                      <p className="font-medium tabular-nums">
                        +{formatCurrency(t.amount, { currency: t.currency })}
                        {t.refunded_at && <Badge variant="destructive" className="ml-2 text-[9px]">Refunded</Badge>}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.topup_method} · {formatDate(t.created_at)}
                        {t.external_reference && ` · ref ${t.external_reference}`}
                      </p>
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      → {formatCurrency(t.balance_after)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Deductions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowDownCircle className="h-4 w-4 text-rose-600" />
              Deductions ({deductions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {deductions.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No deductions yet.</p>
            ) : (
              <ul className="divide-y">
                {deductions.map((d) => (
                  <li key={d.id} className="flex items-start justify-between p-3 text-sm hover:bg-muted/40">
                    <div>
                      <p className="font-medium tabular-nums">−{formatCurrency(d.amount)}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">
                        {d.reason}
                        {d.units_consumed && ` · ${d.units_consumed} units @ ${d.unit_price}`}
                        {" · "}{formatDate(d.created_at)}
                      </p>
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      → {formatCurrency(d.balance_after)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audit timeline */}
      <div className="mt-6">
        <ActivityTimeline table="utility_wallets" rowId={wallet.id} />
      </div>
    </div>
  );
}
