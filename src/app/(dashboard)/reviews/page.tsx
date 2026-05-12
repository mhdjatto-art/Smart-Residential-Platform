import Link from "next/link";
import { Star } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { listReviews, listServiceProviders } from "@/lib/api/marketplace";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const [reviews, providers] = await Promise.all([listReviews(), listServiceProviders()]);
  const providerById = new Map(providers.map((p) => [p.id, p.provider_name]));
  return (
    <div>
      <PageHeader
        title="Provider reviews"
        description="All resident reviews across the marketplace."
      />
      {reviews.length === 0 ? (
        <EmptyState icon={Star} title="No reviews yet" description="Residents will leave reviews after completing orders." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground text-sm">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Link href={`/service-providers/${r.provider_id}`} className="hover:underline">
                      {providerById.get(r.provider_id) ?? r.provider_id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < r.rating ? "fill-amber-400 stroke-amber-500" : "stroke-muted-foreground"}`} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.title && <span className="font-medium">{r.title}: </span>}
                    <span className="text-muted-foreground">{r.body ?? "—"}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.is_hidden ? "hidden" : r.is_moderated ? "moderated" : "visible"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
