import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guards";
import { listFeatures } from "@/lib/api/saas";

export const dynamic = "force-dynamic";

export default async function FeaturesPage() {
  await requireRole(["super_admin"]);
  const features = await listFeatures();
  const grouped = features.reduce<Record<string, typeof features>>((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Feature catalog"
        titleKey="headers.features_title"
        description="Every feature the platform exposes. Premium features unlock with higher plans." />
      <div className="space-y-6">
        {Object.entries(grouped).map(([category, items]) => (
          <Card key={category}>
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-sm font-semibold capitalize text-muted-foreground">{category}</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((f) => (
                  <TableRow key={f.key}>
                    <TableCell className="font-mono text-xs">{f.key}</TableCell>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{f.description ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                        f.is_premium ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {f.is_premium ? <><Sparkles className="inline h-3 w-3" /> Premium</> : "Standard"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ))}
      </div>
    </div>
  );
}
