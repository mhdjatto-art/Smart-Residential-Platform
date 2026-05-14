"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";

export interface WalletRow {
  id: string;
  organization_id: string;
  compound_id: string;
  resident_id: string;
  meter_id: string | null;
  utility_type: string;
  balance: number;
  currency: string;
  low_balance_threshold: number;
  auto_cutoff_at_zero: boolean;
  status: "active" | "suspended" | "closed";
  service_state: "connected" | "disconnected" | "grace_period";
  cutoff_at: string | null;
  restored_at: string | null;
  last_topup_at: string | null;
  last_topup_amount: number | null;
  last_deduction_at: string | null;
  total_topped_up: number;
  total_consumed: number;
  created_at: string;
}

export interface TopupRow {
  id: string;
  wallet_id: string;
  amount: number;
  currency: string;
  balance_before: number;
  balance_after: number;
  topup_method: string;
  external_reference: string | null;
  notes: string | null;
  refunded_at: string | null;
  created_at: string;
}

export interface DeductionRow {
  id: string;
  wallet_id: string;
  amount: number;
  reason: string;
  balance_before: number;
  balance_after: number;
  units_consumed: number | null;
  unit_price: number | null;
  notes: string | null;
  created_at: string;
}

export interface WalletSummary {
  resident: { id: string; name: string };
  wallets: Array<{
    id: string;
    utility_type: string;
    balance: number;
    currency: string;
    low_balance_threshold: number;
    is_low: boolean;
    is_zero_or_negative: boolean;
    service_state: string;
    status: string;
    last_topup_at: string | null;
    last_topup_amount: number | null;
    total_topped_up: number;
    total_consumed: number;
  }>;
  recent_topups: Array<{
    id: string; amount: number; method: string; balance_after: number; created_at: string;
  }>;
  pending_tokens: Array<{
    id: string; token: string; units: number; amount: number; generated_at: string; expires_at: string | null;
  }>;
}

/** Resident self-service — calls the get_wallet_summary RPC. */
export async function getMyWalletSummary(): Promise<WalletSummary | null> {
  await requireUser();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_wallet_summary", { p_resident_id: null });
  if (error) {
    console.error("[getMyWalletSummary] failed:", error.message);
    return null;
  }
  if ((data as { error?: string })?.error) return null;
  return data as WalletSummary;
}

/** List wallets across the org — paged. */
export async function listWallets(opts: {
  utilityType?: string;
  status?: string;
  serviceState?: string;
  lowBalanceOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ data: WalletRow[]; total: number }> {
  await requireRole(["super_admin","developer_admin","compound_manager","finance_officer"]);
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 25);
  const from = (page - 1) * pageSize;
  const to   = from + pageSize - 1;

  let q = supabase.from("utility_wallets").select("*", { count: "exact" })
    .order("balance", { ascending: true })
    .range(from, to);
  if (opts.utilityType)  q = q.eq("utility_type", opts.utilityType);
  if (opts.status)       q = q.eq("status", opts.status);
  if (opts.serviceState) q = q.eq("service_state", opts.serviceState);
  if (opts.lowBalanceOnly) {
    // Filter wallets where balance <= threshold (best-effort via large filter expression)
    q = q.lt("balance", 100_000_000);  // placeholder — the real filter is in the where clause below
  }

  const { data, count, error } = await q;
  if (error) {
    console.error("[listWallets] failed:", error.message);
    return { data: [], total: 0 };
  }
  let rows = (data ?? []) as unknown as WalletRow[];
  if (opts.lowBalanceOnly) rows = rows.filter(r => r.balance <= r.low_balance_threshold);
  return { data: rows, total: count ?? 0 };
}

/** Get one wallet + recent topups + deductions for the manager. */
export async function getWalletDetail(id: string): Promise<{
  wallet: WalletRow;
  topups: TopupRow[];
  deductions: DeductionRow[];
} | null> {
  await requireRole(["super_admin","developer_admin","compound_manager","finance_officer"]);
  const supabase = await createClient();

  const { data: w, error: e1 } = await supabase.from("utility_wallets").select("*").eq("id", id).maybeSingle();
  if (e1 || !w) return null;

  const [{ data: t }, { data: d }] = await Promise.all([
    supabase.from("wallet_topups").select("*").eq("wallet_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("wallet_deductions").select("*").eq("wallet_id", id).order("created_at", { ascending: false }).limit(50),
  ]);

  return {
    wallet: w as unknown as WalletRow,
    topups: (t ?? []) as unknown as TopupRow[],
    deductions: (d ?? []) as unknown as DeductionRow[],
  };
}

/** Resident top-up via cash/transfer/Stripe (manager records cash; resident initiates online). */
export async function topupWalletAction(input: {
  walletId: string;
  amount: number;
  method: "cash" | "bank_transfer" | "stripe" | "fastpay" | "zaincash" | "asiapay" | "nass" | "qicard" | "admin_credit";
  paymentId?: string;
  externalRef?: string;
  notes?: string;
}): Promise<string> {
  const user = await requireUser();
  const supabase = await createClient();

  // Cash / bank_transfer / admin_credit require management role.
  // Online methods (Stripe / FastPay / ZainCash / AsiaPay / NASS Pay / Qi Card)
  // can be initiated by the resident.
  const onlineMethods = new Set(["stripe","fastpay","zaincash","asiapay","nass","qicard"]);
  if (!onlineMethods.has(input.method)) {
    if (!user.isSuperAdmin &&
        !user.roles.some(r => ["super_admin","developer_admin","compound_manager","finance_officer"].includes(r.role))) {
      throw new Error("Only management can record offline top-ups");
    }
  }

  if (input.amount <= 0) throw new Error("Amount must be > 0");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("topup_wallet", {
    p_wallet_id:       input.walletId,
    p_amount:          input.amount,
    p_method:          input.method,
    p_payment_id:      input.paymentId ?? null,
    p_external_ref:    input.externalRef ?? null,
    p_idempotency_key: null,
    p_notes:           input.notes ?? null,
  });
  if (error) throw new Error(`topup_wallet: ${error.message}`);

  // After a successful top-up, ensure service is restored if it was cut off.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).rpc("restore_after_topup", { p_wallet_id: input.walletId }).catch(() => {});

  revalidatePath("/m/wallet");
  revalidatePath("/wallets");
  revalidatePath(`/wallets/${input.walletId}`);
  return String(data);
}

/** Manager: update the low-balance threshold + auto-cutoff toggle. */
export async function updateWalletSettings(walletId: string, input: {
  low_balance_threshold?: number;
  auto_cutoff_at_zero?: boolean;
  status?: "active" | "suspended" | "closed";
}): Promise<void> {
  await requireRole(["super_admin","developer_admin","compound_manager","finance_officer"]);
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.low_balance_threshold !== undefined) patch.low_balance_threshold = input.low_balance_threshold;
  if (input.auto_cutoff_at_zero    !== undefined) patch.auto_cutoff_at_zero    = input.auto_cutoff_at_zero;
  if (input.status                 !== undefined) patch.status                 = input.status;
  if (Object.keys(patch).length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("utility_wallets").update(patch).eq("id", walletId);
  if (error) throw new Error(error.message);
  revalidatePath(`/wallets/${walletId}`);
}

/** Manager: refund a top-up. */
export async function refundTopupAction(topupId: string, reason: string): Promise<void> {
  await requireRole(["super_admin","developer_admin","compound_manager","finance_officer"]);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("refund_wallet_topup", { p_topup_id: topupId, p_reason: reason });
  if (error) throw new Error(error.message);
  revalidatePath("/wallets");
}

/** Manager: transfer balance between two wallets. */
export async function transferBalanceAction(input: {
  fromWalletId: string; toWalletId: string; amount: number; reason: string;
}): Promise<void> {
  await requireRole(["super_admin","developer_admin","compound_manager","finance_officer"]);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("transfer_wallet_balance", {
    p_from_wallet_id: input.fromWalletId,
    p_to_wallet_id:   input.toWalletId,
    p_amount:         input.amount,
    p_reason:         input.reason,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/wallets");
}
