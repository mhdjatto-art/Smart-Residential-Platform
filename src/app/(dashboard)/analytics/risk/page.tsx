import { Activity } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { RecomputeRiskButton } from "@/components/control-center/recompute-risk-button";
import { listOverdueRisk } from "@/lib/api/analytics";

export const dynamic = "force-dynamic";

export default async function OverdueRiskPage() {
  const rows = await listOverdueRisk();
  return (
    <div>
      <PageHeader
        title="Overdue risk scoring"
        titleKey="headers.risk_title"
        description="Heuristic predictor (heuristic-v1). Higher scores = greater likelihood of continued delinquency. Recompute regularly."
        descKey="headers.risk_desc"
        actions={<RecomputeRiskButton />}
      />
      {rows.length === 0 ? (
        <EmptyState icon={Activity} title="No risk scores yet" description="Click 'Recompute' to score residents from current installments." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resident</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Band</TableHead>
                <TableHead>Overdue count</TableHead>
                <TableHead>Days overdue</TableHead>
                <TableHead>Predicted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const rationale = r.rationale as { overdue_count?: number; max_days_overdue?: number; overdue_amount?: number };
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">{r.resident_name ?? r.subject_id.slice(0, 8)}</TableCell>
                    <TableCell className="font-mono text-sm">{(r.score * 100).toFixed(0)}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                        r.band === "critical" ? "bg-rose-100 text-rose-700" :
                        r.band === "high"     ? "bg-orange-100 text-orange-700" :
                        r.band === "medium"   ? "bg-amber-100 text-amber-700" :
                                                "bg-emerald-100 text-emerald-700"
                      }`}>{r.band}</span>
                    </TableCell>
                    <TableCell>{rationale.overdue_count ?? 0}</TableCell>
                    <TableCell>{rationale.max_days_overdue ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.predicted_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
