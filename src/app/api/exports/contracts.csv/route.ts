/**
 * GET /api/exports/contracts.csv?status=active&compound=…
 *
 * Streams a CSV export of contracts in the caller's tenant scope. RLS handles
 * the isolation — we just dump the rows the caller is allowed to see.
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { csvResponse, toCsv } from "@/lib/api/csv";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const sp = request.nextUrl.searchParams;

  let q = supabase.from("installment_contracts").select("*").order("created_at", { ascending: false }).limit(10000);
  const status = sp.get("status");
  if (status && status !== "all") q = q.eq("contract_status", status);
  const compound = sp.get("compound");
  if (compound) q = q.eq("compound_id", compound);

  const { data, error } = await q;
  if (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }

  type Row = {
    contract_number: string; contract_type: string; contract_status: string;
    contract_start_date: string; contract_end_date: string | null;
    currency: string | null; total_property_price: number; down_payment: number;
    financed_amount: number; installment_count: number; monthly_amount: number | null;
    annual_interest_rate: number; created_at: string;
  };
  const rows = (data ?? []) as unknown as Row[];

  const headers = [
    "Contract #", "Type", "Status", "Currency",
    "Start date", "End date",
    "Total price", "Down payment", "Financed", "Installments", "Monthly",
    "Interest %", "Created",
  ];
  const body = rows.map((c) => [
    c.contract_number, c.contract_type, c.contract_status, c.currency ?? "USD",
    c.contract_start_date, c.contract_end_date ?? "",
    c.total_property_price, c.down_payment, c.financed_amount,
    c.installment_count, c.monthly_amount ?? "",
    c.annual_interest_rate, c.created_at.slice(0, 10),
  ]);

  const csv = toCsv(headers, body);
  const filename = `contracts-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(csv, filename);
}
