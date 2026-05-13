import { History, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecordActivity, type AuditRow } from "@/lib/api/audit";
import { diffKeys } from "@/lib/audit/diff";
import { formatDate } from "@/lib/utils";

const TONE: Record<string, string> = {
  insert: "text-emerald-700",
  update: "text-sky-700",
  delete: "text-rose-700",
};
const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  insert: Plus,
  update: Pencil,
  delete: Trash2,
};
const LABEL: Record<string, string> = {
  insert: "created",
  update: "updated",
  delete: "deleted",
};

/**
 * Inline activity timeline for an entity detail page. Server component — gates
 * by role (requireRole inside getRecordActivity) and returns null if the
 * caller can't see audit data (or the row has no changes yet).
 */
export async function ActivityTimeline({ table, rowId, limit = 10 }: { table: string; rowId: string; limit?: number }) {
  let rows: AuditRow[] = [];
  try {
    rows = await getRecordActivity(table, rowId, limit);
  } catch {
    return null;
  }
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {rows.map((r) => {
            const Icon = ICON[r.action] ?? History;
            const tone = TONE[r.action] ?? "text-muted-foreground";
            const label = LABEL[r.action] ?? r.action;
            const changedKeys = r.action === "update" ? diffKeys(r.diff) : [];
            return (
              <li key={r.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone}`} />
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-medium">
                      {r.actor_email ?? (r.actor_id ? `${r.actor_id.slice(0, 8)}…` : "system")}
                    </span>{" "}
                    <span className="text-muted-foreground">{label}</span>
                    {changedKeys.length > 0 && (
                      <span className="text-muted-foreground"> · {changedKeys.slice(0, 3).join(", ")}{changedKeys.length > 3 ? "…" : ""}</span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(r.created_at)} · {new Date(r.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
