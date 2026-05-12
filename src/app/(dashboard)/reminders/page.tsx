import Link from "next/link";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { GenerateButton, DismissButton } from "@/components/reminders/reminder-actions";
import { listReminders } from "@/lib/api/reminders";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kind?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const { data: reminders, total } = await listReminders({
    status: sp.status,
    kind: sp.kind,
    page,
    pageSize: PAGE_SIZE,
  });

  // Hydrate resident + contract labels in one round-trip each.
  const residentIds = Array.from(new Set(reminders.map((r) => r.resident_id)));
  const contractIds = Array.from(new Set(reminders.map((r) => r.contract_id)));
  const supabase = await createClient();

  const [residentsRes, contractsRes] = await Promise.all([
    residentIds.length
      ? supabase.from("residents").select("id, first_name, last_name").in("id", residentIds)
      : Promise.resolve({ data: [] as unknown[] }),
    contractIds.length
      ? supabase.from("installment_contracts").select("id, contract_number").in("id", contractIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const resMap = new Map<string, string>();
  for (const r of (residentsRes.data ?? []) as unknown as Array<{ id: string; first_name: string; last_name: string }>) {
    resMap.set(r.id, `${r.first_name} ${r.last_name}`);
  }
  const cMap = new Map<string, string>();
  for (const c of (contractsRes.data ?? []) as unknown as Array<{ id: string; contract_number: string }>) {
    cMap.set(c.id, c.contract_number);
  }

  return (
    <div>
      <PageHeader
        title="Reminders"
        description="Automated alerts for upcoming and overdue installments."
        actions={<GenerateButton />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          paramName="kind"
          placeholder="kind"
          options={[
            { value: "upcoming", label: "Upcoming" },
            { value: "overdue", label: "Overdue" },
            { value: "penalty", label: "Penalty applied" },
            { value: "payment_received", label: "Payment received" },
          ]}
        />
        <FilterSelect
          paramName="status"
          placeholder="status"
          options={[
            { value: "pending", label: "Pending" },
            { value: "sent", label: "Sent" },
            { value: "dismissed", label: "Dismissed" },
            { value: "failed", label: "Failed" },
          ]}
        />
      </div>

      {reminders.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No reminders yet"
          description="Click 'Generate reminders' to scan active contracts for upcoming and overdue installments."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kind</TableHead>
                <TableHead>Resident</TableHead>
                <TableHead>Contract</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {reminders.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <StatusBadge status={r.kind} />
                  </TableCell>
                  <TableCell>{resMap.get(r.resident_id) ?? "—"}</TableCell>
                  <TableCell>
                    <Link href={`/contracts/${r.contract_id}`} className="font-mono hover:underline">
                      {cMap.get(r.contract_id) ?? r.contract_id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{r.channel.replace("_", " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(r.scheduled_for)}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending" && <DismissButton id={r.id} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination total={total} pageSize={PAGE_SIZE} page={page} />
        </Card>
      )}
    </div>
  );
}
