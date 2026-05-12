import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { csvResponse, toCsv } from "@/lib/api/csv";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const sp = request.nextUrl.searchParams;

  let q = supabase.from("payments").select("*").order("payment_date", { ascending: false }).limit(10000);
  const status = sp.get("status");
  if (status && status !== "all") q = q.eq("payment_status", status);
  const contract = sp.get("contract");
  if (contract) q = q.eq("contract_id", contract);

  const { data, error } = await q;
  if (error) return new Response(`Error: ${error.message}`, { status: 500 });

  type Row = {
    payment_reference: string; payment_date: string; payment_method: string;
    payment_amount: number; currency: string | null; payment_status: string;
    external_reference: string | null; contract_id: string; resident_id: string;
    reversed_at: string | null; reversal_reason: string | null; notes: string | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  const headers = [
    "Reference", "Date", "Method", "Amount", "Currency", "Status",
    "External ref", "Contract ID", "Resident ID",
    "Reversed at", "Reversal reason", "Notes",
  ];
  const body = rows.map((p) => [
    p.payment_reference, p.payment_date, p.payment_method, p.payment_amount, p.currency ?? "USD", p.payment_status,
    p.external_reference ?? "", p.contract_id, p.resident_id,
    p.reversed_at ?? "", p.reversal_reason ?? "", p.notes ?? "",
  ]);

  const csv = toCsv(headers, body);
  const filename = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(csv, filename);
}
