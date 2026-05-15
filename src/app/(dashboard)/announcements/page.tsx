import Link from "next/link";
import { Megaphone, Pin, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { listAnnouncements } from "@/lib/api/announcements";
import { isStaff, requireUser, requireCapability } from "@/lib/auth/guards";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  await requireCapability("compound:read");
  const user = await requireUser();
  const announcements = await listAnnouncements();
  const staff = isStaff(user);

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Community-wide and compound-specific notices."
        actions={
          staff ? (
            <Button asChild>
              <Link href="/announcements/new"><Plus className="h-4 w-4" />New announcement</Link>
            </Button>
          ) : undefined
        }
      />

      {announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements"
          description={staff ? "Publish updates to your community." : "Your community administrators haven't posted anything yet."}
        />
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status={a.kind} />
                      {a.is_pinned && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Pin className="h-3 w-3" /> Pinned
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{formatDate(a.published_at)}</span>
                      {a.expires_at && (
                        <span className="text-xs text-muted-foreground">· Expires {formatDate(a.expires_at)}</span>
                      )}
                    </div>
                    <h2 className="text-lg font-semibold">{a.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{a.body}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
