"use server";

/**
 * Phase 20B — Cashier quick-pay queue.
 *
 * Surfaces unpaid installment_schedules across ALL active contracts in one
 * flat list so the finance officer can find the right row by resident name
 * or contract number without drilling down. Used by /payments/quick.
 */

import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/auth/guards";

export interface CashierQueueRow {
  installment_id:      string;
  contract_id:         string;
  contract_number:     string;
  contract_type:       "property_sale" | "rental" | "lease_to_own";
  resident_id:         string;
  resident_name:       string;
  unit_number:         string | null;
  building_name:       string | null;
  installment_number:  number;
  due_date:            string;
  total_due:           number;
  penalty_amount:      number;
  paid_amount:         number;
  remaining:           number;
  status:              string;
  currency:            string;
}

/**
 * Returns unpaid installment rows across all active contracts.
 *
 * @param search — optional case-insensitive filter on resident name, contract
 *                 number or unit number.
 * @param onlyOverdue — when true, hides upcoming installments (due in future).
 */
export async function listCashierQueue(opts: {
  search?:     string;
  onlyOverdue?: boolean;
  limit?:      number;
} = {}): Promise<CashierQueueRow[]> {
  await requireCapability("payment:write");
  const supabase = await createClient();

  // Pull schedules + parent contract + resident + unit in one round-trip.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from("installment_schedules")
    .select(`
      id, installment_number, due_date, total_due, penalty_amount, paid_amount, status,
      installment_contracts!inner (
        id, contract_number, contract_type, currency,
        residents!inner ( id, first_name, last_name, units ( unit_number, buildings ( name ) ) )
      )
    `)
    .neq("status", "paid")
    .order("due_date", { ascending: true })
    .limit(opts.limit ?? 200);

  if (opts.onlyOverdue) {
    const today = new Date().toISOString().slice(0, 10);
    q = q.lte("due_date", today);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  const flat: CashierQueueRow[] = rows.map((s) => {
    const c = s.installment_contracts;
    const r = c?.residents;
    const u = r?.units;
    const b = u?.buildings;
    const total = Number(s.total_due);
    const penalty = Number(s.penalty_amount ?? 0);
    const paid = Number(s.paid_amount ?? 0);
    return {
      installment_id:     s.id,
      contract_id:        c?.id ?? "",
      contract_number:    c?.contract_number ?? "",
      contract_type:      c?.contract_type ?? "property_sale",
      resident_id:        r?.id ?? "",
      resident_name:      [r?.first_name, r?.last_name].filter(Boolean).join(" ") || "—",
      unit_number:        u?.unit_number ?? null,
      building_name:      b?.name ?? null,
      installment_number: s.installment_number,
      due_date:           s.due_date,
      total_due:          total,
      penalty_amount:     penalty,
      paid_amount:        paid,
      remaining:          Math.max(0, total + penalty - paid),
      status:             s.status,
      currency:           c?.currency ?? "IQD",
    };
  });

  // Client-side filter for searchable text fields (Supabase doesn't do nested ilike easily here).
  if (opts.search?.trim()) {
    const term = opts.search.trim().toLowerCase();
    return flat.filter(
      (r) =>
        r.resident_name.toLowerCase().includes(term) ||
        r.contract_number.toLowerCase().includes(term) ||
        (r.unit_number ?? "").toLowerCase().includes(term),
    );
  }

  return flat;
}
