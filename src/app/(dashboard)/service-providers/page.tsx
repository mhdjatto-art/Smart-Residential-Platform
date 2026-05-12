import Link from "next/link";
import { Plus, Store, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { listServiceProviders } from "@/lib/api/marketplace";

export const dynamic = "force-dynamic";

export default async function ServiceProvidersPage() {
  const providers = await listServiceProviders();
  return (
    <div>
      <PageHeader
        title="Service providers"
        description="Marketplace providers offering on-demand services and products to residents."
        actions={
          <Button asChild>
            <Link href="/service-providers/new"><Plus className="h-4 w-4" />Add provider</Link>
          </Button>
        }
      />
      {providers.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No service providers yet"
          description="Register your first marketplace provider — restaurant, plumber, cleaner, grocery, etc."
          action={<Button asChild><Link href="/service-providers/new">Add provider</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => (
                <TableRow key={p.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/service-providers/${p.id}`} className="hover:underline">{p.provider_name}</Link>
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{p.provider_kind.replace("_", " ")}</TableCell>
                  <TableCell className="text-sm">
                    {p.rating_count > 0 ? (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 stroke-amber-500" />
                        {p.rating_avg.toFixed(2)} <span className="text-xs text-muted-foreground">({p.rating_count})</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No reviews</span>
                    )}
                  </TableCell>
                  <TableCell><StatusBadge status={p.verification_status} /></TableCell>
                  <TableCell><StatusBadge status={p.availability_status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.default_commission_kind === "percentage"
                      ? `${p.default_commission_value}%`
                      : `${p.default_commission_value} flat`}
                  </TableCell>
                  <TableCell><StatusBadge status={p.is_active ? "active" : "inactive"} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
