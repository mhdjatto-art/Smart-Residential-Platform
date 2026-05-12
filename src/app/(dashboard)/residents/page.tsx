import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchBar } from "@/components/shared/search-bar";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { listResidentsPaged } from "@/lib/api/residents";
import { listCompoundOptions } from "@/lib/api/compounds";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function ResidentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string; status?: string; tenancy?: string; compound?: string; page?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const [{ data, total }, compounds] = await Promise.all([
    listResidentsPaged({
      search: sp.q,
      status: sp.status,
      tenancyType: sp.tenancy,
      compoundId: sp.compound,
      page,
      pageSize: PAGE_SIZE,
    }),
    listCompoundOptions(),
  ]);

  return (
    <div>
      <PageHeader
        title="Residents"
        description="Owners, tenants, family members, and guests across your compounds."
        actions={
          <Button asChild>
            <Link href="/residents/new"><Plus className="h-4 w-4" />Add resident</Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2"><SearchBar placeholder="Search by name, email, mobile, ID…" /></div>
        <FilterSelect
          paramName="compound"
          placeholder="compound"
          options={compounds.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect
          paramName="tenancy"
          placeholder="tenancy"
          options={[
            { value: "owner", label: "Owner" },
            { value: "tenant", label: "Tenant" },
            { value: "family_member", label: "Family member" },
            { value: "guest", label: "Guest" },
          ]}
        />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No residents found"
          description="Add residents to start tracking who lives in each unit."
          action={<Button asChild><Link href="/residents/new">Add resident</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Tenancy</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/residents/${r.id}`} className="font-medium hover:underline">
                      {r.first_name} {r.last_name}
                    </Link>
                    {r.national_id && (
                      <div className="text-xs font-mono text-muted-foreground">ID: {r.national_id}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.mobile ?? r.phone ?? "—"}</TableCell>
                  <TableCell className="capitalize">{r.tenancy_type.replace("_", " ")}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(r.created_at)}</TableCell>
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
