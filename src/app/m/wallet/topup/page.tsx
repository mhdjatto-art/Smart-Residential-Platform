import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MobileTopbar } from "@/components/mobile/topbar";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { createClient } from "@/lib/supabase/server";
import { TopupForm } from "@/components/wallet/topup-form";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Top up wallet" };
export const dynamic = "force-dynamic";

export default async function MobileWalletTopupPage({
  searchParams,
}: { searchParams: Promise<{ wallet?: string }> }) {
  const ctx = await getResidentContext();
  const { t } = await getT();
  const sp = await searchParams;
  if (!sp.wallet) notFound();

  const supabase = await createClient();
  const { data: wallet } = await supabase
    .from("utility_wallets")
    .select("id, utility_type, balance, currency, status, low_balance_threshold, service_state")
    .eq("id", sp.wallet)
    .eq("resident_id", ctx.resident_id ?? "")
    .maybeSingle();

  if (!wallet) notFound();

  return (
    <div>
      <MobileTopbar title={t("wallet.topup_now")} userId={ctx.user_id} unread={0} showBack />
      <div className="p-4">
        <TopupForm
          walletId={(wallet as { id: string }).id}
          utilityType={(wallet as { utility_type: string }).utility_type}
          currentBalance={(wallet as { balance: number }).balance}
          currency={(wallet as { currency: string }).currency}
        />
      </div>
    </div>
  );
}
