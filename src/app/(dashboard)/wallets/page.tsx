import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Ban, CheckCircle2, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { listWallets } from "@/lib/api/wallets";
import { formatCurrency, formatDate } from "@/lib/utils";
import { requireCapability } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Wallets" };
export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function WalletsPage({
  searchParams,
}: {
  searchParams: Promise<{
    utility?: string; status?: string; service?: string; low?: string; page?: string;
  }>;
}) {
  await requireCapability("utility:read");
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const { data, total } = await listWallets({
    utilityType:    sp.utility,
    status:         sp.status,
    serviceState:   sp.service,
    lowBalanceOnly: sp.low === "true",
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        title="Prepaid wallets"
        description="Every active wallet across the org. Filter by utility, status, or low-balance threshold."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect paramName="utility" placeholder="any utility"
          options={[
            { value: "electricity", label: "Electricity" },
            { value: "water",       label: "Water" },
            { value: "gas",         label: "Gas" },
            { value: "internet",    label: "Internet" },
          ]} />
        <FilterSelect paramName="status" placeholder="any status"
          options={[
            { value: "active",    label: "Active" },
            { value: "suspended", label: "Suspended" },
            { value: "closed",    label: "Closed" },
          ]} />
        <FilterSelect paramName="service" placeholder="any service state"
          options={[
            { value: "connected",      label: "Connected" },
            { value: "disconnected",   label: "Disconnected (cut-off)" },
            { value: "grace_period",   label: "Grace period" },
          ]} />
        <FilterSelect paramName="low" placeholder="low balance"
          options={[{ value: "true", label: "Low balance only" }]} />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No wallets yet"
          description="Wallets are auto-created when a prepaid subscription is added. Set billing_mode='prepaid' on a subscription to create one."
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Wallet</th>
                <th className="px-3 py-2 text-left">Utility</th>
                <th className="hidden px-3 py-2 text-right md:table-cell">Balance</th>
                <th className="hidden px-3 py-2 text-right lg:table-cell">Threshold</th>
                <th className="px-3 py-2 text-left">State</th>
                <th className="hidden px-3 py-2 text-left lg:table-cell">Last top-up</th>
              </tr>
            </thead>
            <tbody>
              {data.map((w) => {
                const isLow = w.balance <= w.low_balance_threshold;
                const isZero = w.balance <= 0;
                return (
                  <tr key={w.id} className="border-t hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <Link href={`/wallets/${w.id}`} className="font-mono text-xs hover:underline">
                        {w.id.slice(0, 8)}
                      </Link>
                      <p className="text-[10px] text-muted-foreground">{w.resident_id.slice(0, 8)}</p>
                    </td>
                    <td className="px-3 py-2 capitalize">{w.utility_type}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">
                      <span className={isZero ? "text-rose-700 font-medium" : isLow ? "text-amber-700 font-medium" : ""}>
                        {formatCurrency(w.balance, { currency: w.currency })}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2 text-right text-xs tabular-nums text-muted-foreground lg:table-cell">
                      {formatCurrency(w.low_balance_threshold, { currency: w.currency })}
                    </td>
                    <td className="px-3 py-2">
                      {w.service_state === "connected" && (
                        <Badge variant="muted" className="text-[10px]">
                          <CheckCircle2 className="h-3 w-3" /> Connected
                        </Badge>
                      )}
                      {w.service_state === "disconnected" && (
                        <Badge variant="destructive" className="text-[10px]">
                          <Ban className="h-3 w-3" /> Cut-off
                        </Badge>
                      )}
                      {isLow && !isZero && w.service_state === "connected" && (
                        <Badge variant="muted" className="ml-1 bg-amber-100 text-[10px] text-amber-800">
                          <AlertTriangle className="h-3 w-3" /> Low
                        </Badge>
                      )}
                    </td>
                    <td className="hidden px-3 py-2 text-xs text-muted-foreground lg:table-cell">
                      {w.last_topup_at ? `${formatDate(w.last_topup_at)} (${formatCurrency(w.last_topup_amount ?? 0)})` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t p-3">
            <Pagination total={total} pageSize={PAGE_SIZE} page={page} />
          </div>
        </Card>
      )}
    </div>
  );
}
