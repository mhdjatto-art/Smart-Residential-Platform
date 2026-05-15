import type { Metadata } from "next";
import Link from "next/link";
import { FileSignature, FileText, CheckCircle2 } from "lucide-react";
import { MobileTopbar } from "@/components/mobile/topbar";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { listResidentContracts } from "@/lib/api/contract-signatures";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "My contracts" };
export const dynamic = "force-dynamic";

export default async function MobileContractsPage() {
  const ctx = await getResidentContext();
  const contracts = await listResidentContracts();
  const { t } = await getT();

  return (
    <div>
      <MobileTopbar title={t("mobile.my_contracts")} userId={ctx.user_id} unread={0} showBack />
      <div className="p-4">
        {contracts.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              {t("mobile.no_contracts")}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {contracts.map((c) => {
              const cur = c.currency ?? ctx.currency;
              return (
                <li key={c.id}>
                  <Link
                    href={`/m/contracts/${c.id}`}
                    className="block rounded-xl border bg-card p-4 hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <p className="truncate font-medium font-mono text-sm">{c.contract_number}</p>
                        </div>
                        <p className="mt-1 text-[11px] capitalize text-muted-foreground">
                          {c.contract_type.replace(/_/g, " ")} · {c.contract_status}
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {c.total_property_price
                            ? formatCurrency(c.total_property_price, { currency: cur })
                            : c.monthly_amount
                            ? t("mobile.per_month", { amount: formatCurrency(c.monthly_amount, { currency: cur }) })
                            : "—"}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {c.is_signed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" /> {t("mobile.signed_badge")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            <FileSignature className="h-3 w-3" /> {t("mobile.pending_badge")}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
