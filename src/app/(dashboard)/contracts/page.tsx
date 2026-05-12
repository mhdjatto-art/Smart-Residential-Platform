import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchBar } from "@/components/shared/search-bar";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { listContractsPaged } from "@/lib/api/contracts";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; contract_type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { data, total } = await listContractsPaged({
    search: sp.q,
    status: sp.status,
    contractType: sp.contract_type,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Installment contracts: property sales, rentals, and lease-to-own agreements."
        actions={
          <Button asChild>
            <Link href="/contracts/new"><Plus className="h-4 w-4" />New contract</Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2"><SearchBar placeholder="Search by contract number…" /></div>
        <FilterSelect
          paramName="contract_type"
          placeholder="type"
          options={[
            { value: "property_sale", label: "Property sale" },
            { value: "rental", label: "Rental" },
            { value: "lease_to_own", label: "Lease to own" },
          ]}
        />
        <FilterSelect
          paramName="status"
          placeholder="status"
          options={[
            { value: "draft", label: "Draft" },
            { value: "active", label: "Active" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
            { value: "defaulted", label: "Defaulted" },
          ]}
        />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No contracts found"
          description="Create your first installment contract."
          action={<Button asChild><Link href="/contracts/new">New contract</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total price</TableHead>
                <TableHead className="text-right">Financed</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead className="text-right">Start</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/contracts/${c.id}`} className="font-medium hover:underline">{c.contract_number}</Link>
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{c.contract_type.replace(/_/g, " ")}</TableCell>
                  <TableCell><StatusBadge status={c.contract_status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(c.total_property_price)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(c.financed_amount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.monthly_amount !== null ? formatCurrency(c.monthly_amount) : "—"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(c.contract_start_date)}</TableCell>
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
