"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, Banknote, Loader2, Smartphone, Building2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { topupWalletAction } from "@/lib/api/wallets";
import { formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n";

const QUICK_AMOUNTS = [10000, 25000, 50000, 100000, 250000, 500000];

type OnlineMethod = "stripe" | "nass" | "qicard" | "fastpay" | "zaincash" | "asiapay";
type Method = OnlineMethod | "cash";

const ONLINE_METHODS: ReadonlySet<OnlineMethod> = new Set<OnlineMethod>([
  "stripe", "nass", "qicard", "fastpay", "zaincash", "asiapay",
]);

interface TopupFormProps {
  walletId: string;
  utilityType: string;
  currentBalance: number;
  currency: string;
}

export function TopupForm({ walletId, utilityType, currentBalance, currency }: TopupFormProps) {
  const router = useRouter();
  const { t } = useT();
  const [amount, setAmount] = useState<number>(50000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [method, setMethod] = useState<Method>("stripe");
  const [pending, startTransition] = useTransition();

  const utilityLabelKey: Record<string, string> = {
    electricity: "wallet.utility_electricity",
    water:       "wallet.utility_water",
    gas:         "wallet.utility_gas",
    internet:    "wallet.utility_internet",
  };
  const utilityLabel = utilityLabelKey[utilityType]
    ? t(utilityLabelKey[utilityType] as TranslationKey)
    : utilityType;

  function submit() {
    const a = customAmount ? Number(customAmount) : amount;
    if (!a || a <= 0) { toast.error(t("wallet.amount_must_be_positive")); return; }
    if (a < 1000) { toast.error(t("wallet.min_topup")); return; }

    startTransition(async () => {
      try {
        if (method === "cash") {
          toast.info(t("wallet.cash_needs_approval"));
          return;
        }

        // Online gateways — call the unified checkout endpoint, then redirect
        // the browser to the gateway's hosted checkout. On settlement, the
        // gateway's webhook credits the wallet via topup_wallet RPC.
        if (ONLINE_METHODS.has(method)) {
          const res = await fetch(`/api/wallet/topup/${method}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletId, amount: a, currency }),
          });
          const json = (await res.json()) as { checkoutUrl?: string; error?: string };

          if (!res.ok || !json.checkoutUrl) {
            // Fallback to the existing direct-pay path when the gateway is
            // not configured yet (returns 503). This lets you keep recording
            // top-ups in dev before credentials arrive.
            if (res.status === 503) {
              toast.info(t("wallet.gateway_not_configured", { gateway: method.toUpperCase() }), {
                description: t("wallet.gateway_dev_fallback"),
              });
              await directRecord(a, method);
              return;
            }
            throw new Error(json.error ?? `HTTP ${res.status}`);
          }

          // Send the user to the gateway.
          window.location.href = json.checkoutUrl;
          return;
        }

        // Unreachable — `method` is exhaustively handled above.
        toast.error("Unsupported method");
      } catch (e) {
        toast.error(t("wallet.topup_failed"), { description: e instanceof Error ? e.message : "Unknown" });
      }
    });
  }

  /** Dev fallback: when the gateway is not configured, record the top-up
   *  directly through the server action (so the wallet still reflects state). */
  async function directRecord(a: number, m: OnlineMethod) {
    const topupId = await topupWalletAction({
      walletId,
      amount: a,
      method: m,
      notes: `Dev top-up via ${m} (gateway not configured)`,
    });
    toast.success(t("wallet.topup_recorded"), {
      description: `Topup #${topupId.slice(0,8)} · +${formatCurrency(a, { currency })}`,
    });
    router.push("/m/wallet");
    router.refresh();
  }

  // Per-method explanatory copy shown below the picker.
  const methodNoticeKey: Record<Method, string | null> = {
    stripe:   "wallet.notice_stripe",
    fastpay:  "wallet.notice_fastpay",
    zaincash: "wallet.notice_zaincash",
    asiapay:  "wallet.notice_asiapay",
    nass:     "wallet.notice_nass",
    qicard:   "wallet.notice_qicard",
    cash:     null,
  };
  const notice = methodNoticeKey[method] ? t(methodNoticeKey[method] as TranslationKey) : null;

  return (
    <div className="space-y-4">

      {/* Current balance summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{utilityLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{t("wallet.current_balance")}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(currentBalance, { currency })}</p>
        </CardContent>
      </Card>

      {/* Quick-pick amounts */}
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("wallet.pick_amount")}</Label>
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
          <Label htmlFor="custom-amount" className="text-xs">{t("wallet.custom_amount_label")}</Label>
          <Input
            id="custom-amount"
            inputMode="numeric"
            placeholder={t("wallet.custom_amount_placeholder")}
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))}
            className="mt-1 text-lg font-medium tabular-nums"
          />
        </div>
      </div>

      {/* Payment method */}
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("wallet.payment_method")}</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <MethodTile name="stripe"   icon={CreditCard} label={t("wallet.method_card")} sub="Stripe"                        selected={method==="stripe"}   onClick={() => setMethod("stripe")} />
          <MethodTile name="nass"     icon={Wallet}     label="NASS Pay"                sub={t("wallet.method_nass_sub")}    selected={method==="nass"}     onClick={() => setMethod("nass")}    accentClass="text-orange-500" />
          <MethodTile name="qicard"   icon={CreditCard} label="Qi Card"                 sub={t("wallet.method_qicard_sub")}  selected={method==="qicard"}   onClick={() => setMethod("qicard")}  accentClass="text-blue-600" />
          <MethodTile name="fastpay"  icon={Smartphone} label="FastPay"                 sub={t("wallet.method_fastpay_sub")} selected={method==="fastpay"}  onClick={() => setMethod("fastpay")} />
          <MethodTile name="zaincash" icon={Smartphone} label="ZainCash"                sub={t("wallet.method_zaincash_sub")} selected={method==="zaincash"} onClick={() => setMethod("zaincash")} />
          <MethodTile name="asiapay"  icon={Smartphone} label="AsiaHawala"              sub={t("wallet.method_asiapay_sub")} selected={method==="asiapay"}  onClick={() => setMethod("asiapay")} />
          <MethodTile name="cash"     icon={Banknote}   label={t("wallet.method_cash")} sub={t("wallet.method_cash_sub")}    selected={method==="cash"}     onClick={() => setMethod("cash")} />
        </div>

        {notice && (
          <p className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {notice}
          </p>
        )}
      </div>

      <Button onClick={submit} disabled={pending} className="w-full" size="lg">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
        {pending
          ? t("wallet.processing")
          : t("wallet.topup_button", { amount: formatCurrency(customAmount ? Number(customAmount) : amount, { currency }) })}
      </Button>

      <p className="text-center text-[10px] text-muted-foreground">
        {t("wallet.auto_restore_note")}
      </p>
    </div>
  );
}

function MethodTile({
  icon: Icon, label, sub, selected, onClick, accentClass,
}: {
  name: string;
  icon: typeof CreditCard;
  label: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
  accentClass?: string;
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
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${accentClass ?? ""}`} />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </button>
  );
}
