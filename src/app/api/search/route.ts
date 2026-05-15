/**
 * Global search endpoint.
 *
 *   GET /api/search?q=<query>
 *
 * Searches across the most-used entities: residents, units, contracts,
 * payments, tickets, providers. Returns up to 5 results per category with
 * a deep link the UI can navigate to.
 *
 * Auth required. RLS handles per-org isolation.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface Hit {
  type:     "resident" | "unit" | "contract" | "payment" | "ticket" | "provider";
  id:       string;
  title:    string;
  subtitle?: string;
  href:     string;
  icon?:    string;
}

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, "search", 60, 60_000);
  if (limited) return limited;

  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q   = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ hits: [], query: q });
  }

  const supabase = await createClient();
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const hits: Hit[] = [];

  // Run all queries in parallel — each capped at 5 rows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [residents, units, contracts, payments, tickets, providers] = await Promise.all([
    sb.from("residents").select("id, first_name, last_name, email, phone").or(
      `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`,
    ).limit(5),
    sb.from("units").select("id, unit_number, building_id").ilike("unit_number", like).limit(5),
    sb.from("installment_contracts").select("id, contract_number").ilike("contract_number", like).limit(5),
    sb.from("payments").select("id, payment_number, amount").ilike("payment_number", like).limit(5),
    sb.from("tickets").select("id, ticket_number, title").or(
      `ticket_number.ilike.${like},title.ilike.${like}`,
    ).limit(5),
    sb.from("utility_providers").select("id, provider_name, provider_code, provider_type").or(
      `provider_name.ilike.${like},provider_code.ilike.${like}`,
    ).limit(5),
  ]);

  for (const r of residents.data ?? []) {
    hits.push({
      type:     "resident",
      id:       r.id,
      title:    `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || (r.email ?? r.phone ?? "Resident"),
      subtitle: [r.email, r.phone].filter(Boolean).join(" · "),
      href:     `/residents/${r.id}`,
    });
  }
  for (const u of units.data ?? []) {
    hits.push({
      type:     "unit",
      id:       u.id,
      title:    `وحدة ${u.unit_number}`,
      href:     `/units/${u.id}`,
    });
  }
  for (const c of contracts.data ?? []) {
    hits.push({
      type:     "contract",
      id:       c.id,
      title:    `عقد ${c.contract_number}`,
      href:     `/contracts/${c.id}`,
    });
  }
  for (const p of payments.data ?? []) {
    hits.push({
      type:     "payment",
      id:       p.id,
      title:    `دفعة ${p.payment_number}`,
      subtitle: p.amount ? `${p.amount} IQD` : undefined,
      href:     `/payments/${p.id}`,
    });
  }
  for (const t of tickets.data ?? []) {
    hits.push({
      type:     "ticket",
      id:       t.id,
      title:    t.title ?? `Ticket ${t.ticket_number}`,
      subtitle: t.ticket_number,
      href:     `/tickets/${t.id}`,
    });
  }
  for (const p of providers.data ?? []) {
    hits.push({
      type:     "provider",
      id:       p.id,
      title:    p.provider_name,
      subtitle: `${p.provider_type} · ${p.provider_code ?? ""}`,
      href:     `/providers`,
    });
  }

  return NextResponse.json({ hits, query: q });
}
