"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, Banknote, Loader2, Smartphone, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { topupWalletAction } from "@/lib/api/wallets";
import { formatCurrency } from "@/lib/utils";

const QUICK_AMOUNTS = [10000, 25000, 50000, 100000, 250000, 500000];

interface TopupFormProps {
  walletId: string;
  utilityType: string;
  currentBalance: number;
  currency: string;
}

export function TopupForm({ walletId, utilityType, currentBalance, currency }: TopupFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState<number>(50000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [method, setMethod] = useState<"stripe" | "fastpay" | "zaincash" | "asiapay" | "cash">("stripe");
  const [pending, startTransition] = useTransition();

  const utilityLabelAr =
    utilityType === "electricity" ? "كهرباء" :
    utilityType === "water"       ? "ماء"   :
    utilityType === "gas"         ? "غاز"   :
    utilityType === "internet"    ? "إنترنت" : utilityType;

  function submit() {
    const a = customAmount ? Number(customAmount) : amount;
    if (!a || a <= 0) { toast.error("Amount must be > 0"); return; }
    if (a < 1000) { toast.error("Minimum top-up is 1,000 IQD"); return; }

    startTransition(async () => {
      try {
        if (method === "cash") {
          toast.info("الدفع نقداً يحتاج إعتماد من المدير. تواصل مع مكتب الإدارة.");
          return;
        }

        // For online methods, we'd normally redirect to Stripe/FastPay first
        // and the webhook calls topup_wallet. For now we call directly with
        // method='stripe' as a placeholder — the resident still needs to
        // complete payment through Stripe Checkout. Wire that flow in a
        // separate step.
        const topupId = await topupWalletAction({
          walletId,
          amount: a,
          method,
          notes: `Resident-initiated top-up via ${method}`,
        });
        toast.success("Top-up recorded", {
          description: `Topup #${topupId.slice(0,8)} · +${formatCurrency(a, { currency })}`,
        });
        router.push("/m/wallet");
        router.refresh();
      } catch (e) {
        toast.error("Top-up failed", { description: e instanceof Error ? e.message : "Unknown" });
      }
    });
  }

  return (
    <div className="space-y-4">

      {/* Current balance summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{utilityLabelAr}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">الرصيد الحالي</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(currentBalance, { currency })}</p>
        </CardContent>
      </Card>

      {/* Quick-pick amounts */}
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">اختر مبلغاً</Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {QUICK_AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => { setAmount(a); setCustomAmount(""); }}
              className={`rounded-lg border p-3 text-sm font-medium tabular-nums transition-colors ${
                amount === a && !customAmount
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-muted"
              }`}
            >
              {(a / 1000).toLocaleString()}K
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Label htmlFor="custom-amount" className="text-xs">أو أدخل مبلغاً مخصصاً (IQD)</Label>
          <Input
            id="custom-amount"
            inputMode="numeric"
            placeholder="مثلاً: 75000"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))}
            className="mt-1 text-lg font-medium tabular-nums"
          />
        </div>
      </div>

      {/* Payment method */}
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">طريقة الدفع</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <MethodTile name="stripe"   icon={CreditCard}  label="بطاقة ائتمان" sub="Stripe" selected={method==="stripe"}   onClick={() => setMethod("stripe")} />
          <MethodTile name="fastpay"  icon={Smartphone}  label="FastPay"     sub="محفظة محلية" selected={method==="fastpay"}  onClick={() => setMethod("fastpay")} />
          <MethodTile name="zaincash" icon={Smartphone}  label="ZainCash"    sub="محفظة محلية" selected={method==="zaincash"} onClick={() => setMethod("zaincash")} />
          <MethodTile name="asiapay"  icon={Smartphone}  label="AsiaHawala"  sub="محفظة محلية" selected={method==="asiapay"}  onClick={() => setMethod("asiapay")} />
          <MethodTile name="cash"     icon={Banknote}    label="نقداً"       sub="عبر الإدارة"  selected={method==="cash"}     onClick={() => setMethod("cash")} />
        </div>
      </div>

      <Button onClick={submit} disabled={pending} className="w-full" size="lg">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
        {pending ? "جاري المعالجة..." : `شحن ${formatCurrency(customAmount ? Number(customAmount) : amount, { currency })}`}
      </Button>

      <p className="text-center text-[10px] text-muted-foreground">
        الخدمة تُستعاد تلقائياً فور وصول الدفع.
      </p>
    </div>
  );
}

function MethodTile({ icon: Icon, label, sub, selected, onClick }: {
  name: string; icon: typeof CreditCard; label: string; sub: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/10"
          : "border-border bg-card hover:bg-muted"
      }`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </button>
  );
}
