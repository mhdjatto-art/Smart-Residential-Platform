import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { streamCsv } from "@/lib/api/csv";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  payment_reference: string; payment_date: string; payment_method: string;
  payment_amount: number; currency: string | null; payment_status: string;
  external_reference: string | null; contract_id: string; resident_id: string;
  reversed_at: string | null; reversal_reason: string | null; notes: string | null;
};

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, "csv-export", 10, 60_000);
  if (limited) return limited;

  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer"]);
  const supabase = await createClient();
  const sp = request.nextUrl.searchParams;
  const status = sp.get("status");
  const contract = sp.get("contract");

  return streamCsv<Row>({
    filename: `payments-${new Date().toISOString().slice(0, 10)}.csv`,
    headers: [
      "Reference", "Date", "Method", "Amount", "Currency", "Status",
      "External ref", "Contract ID", "Resident ID",
      "Reversed at", "Reversal reason", "Notes",
    ],
    toRow: (p) => [
      p.payment_reference, p.payment_date, p.payment_method, p.payment_amount, p.currency ?? "USD", p.payment_status,
      p.external_reference ?? "", p.contract_id, p.resident_id,
      p.reversed_at ?? "", p.reversal_reason ?? "", p.notes ?? "",
    ],
    pageSize: 1000,
    hardCap: 250_000,
    fetchPage: async (offset, limit) => {
      let q = supabase
        .from("payments")
        .select("*")
        .order("payment_date", { ascending: false })
        .range(offset, offset + limit - 1);
      if (status && status !== "all") {
        // payment_status is an enum — cast to satisfy strict typing.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        q = q.eq("payment_status", status as any);
      }
      if (contract) q = q.eq("contract_id", contract);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Row[];
    },
  });
}
