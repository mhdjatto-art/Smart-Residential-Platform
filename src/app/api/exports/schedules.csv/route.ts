import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { streamCsv } from "@/lib/api/csv";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  contract_id: string; installment_number: number; due_date: string;
  principal_amount: number; interest_amount: number; penalty_amount: number;
  total_due: number; paid_amount: number; status: string; paid_at: string | null;
};

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, "csv-export", 10, 60_000);
  if (limited) return limited;

  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const sp = request.nextUrl.searchParams;
  const contractId = sp.get("contract");

  return streamCsv<Row>({
    filename: contractId
      ? `schedule-${contractId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`
      : `schedules-${new Date().toISOString().slice(0, 10)}.csv`,
    headers: [
      "Contract ID", "#", "Due date",
      "Principal", "Interest", "Penalty", "Total due", "Paid",
      "Outstanding", "Status", "Paid at",
    ],
    toRow: (s) => [
      s.contract_id, s.installment_number, s.due_date,
      s.principal_amount, s.interest_amount, s.penalty_amount,
      s.total_due, s.paid_amount,
      Number(s.total_due) + Number(s.penalty_amount) - Number(s.paid_amount),
      s.status, s.paid_at ?? "",
    ],
    pageSize: 1000,
    hardCap: 500_000, // schedules can be large (many installments per contract)
    fetchPage: async (offset, limit) => {
      let q = supabase
        .from("installment_schedules")
        .select("*")
        .order("contract_id")
        .order("installment_number")
        .range(offset, offset + limit - 1);
      if (contractId) q = q.eq("contract_id", contractId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Row[];
    },
  });
}
