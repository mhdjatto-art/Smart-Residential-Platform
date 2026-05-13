import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ bill?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-6">
      <div className="rounded-full bg-emerald-100 p-4 dark:bg-emerald-950/40">
        <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h1 className="mt-6 text-2xl font-bold">Payment received</h1>
      <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
        Thank you. Your payment is being processed. Your bill will update within a few seconds.
      </p>
      {sp.bill && (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">Ref: {sp.bill}</p>
      )}
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/m/payments">Back to payments</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/m">Home</Link>
        </Button>
      </div>
    </div>
  );
}
