import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ bill?: string }>;
}) {
  const sp = await searchParams;
  const { t } = await getT();
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-6">
      <div className="rounded-full bg-emerald-100 p-4 dark:bg-emerald-950/40">
        <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h1 className="mt-6 text-2xl font-bold">{t("mobile.payment_received")}</h1>
      <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
        {t("mobile.payment_thank_you")}
      </p>
      {sp.bill && (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">{t("mobile.payment_ref", { ref: sp.bill })}</p>
      )}
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        {sp.bill && (
          <Button asChild>
            <Link href={`/m/payments/${sp.bill}/receipt`}>{t("mobile.view_receipt")}</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/m/payments">{t("mobile.back_to_payments")}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/m">{t("mobile.home")}</Link>
        </Button>
      </div>
    </div>
  );
}
