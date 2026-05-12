import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { listResidents } from "@/lib/api/residents";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ResidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const residents = await listResidents({ search: sp.q, limit: 200 });

  return (
    <div>
      <PageHeader
        title="Residents"
        description="People living in your compounds — owners, tenants, family members, and approved guests."
        actions={
          <Button asChild>
            <Link href="/residents/new">
              <Plus className="h-4 w-4" />
              Add resident
            </Link>
          </Button>
        }
      />

      {residents.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No residents yet"
          description="Add your first resident to get started. You'll need at least one unit set up first."
          action={
            <Button asChild>
              <Link href="/residents/new">Add resident</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tenancy</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Move-in</TableHead>
                <TableHead className="text-right">Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {residents.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/residents/${r.id}`} className="font-medium hover:underline">
                      {r.first_name} {r.last_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.email ?? "—"}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">
                    {r.tenancy_type.replace("_", " ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "active" ? "success" : r.status === "former" ? "muted" : "warning"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(r.move_in_date)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
