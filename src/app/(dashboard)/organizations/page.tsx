import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { listOrganizations } from "@/lib/api/organizations";
import { requireRole } from "@/lib/auth/guards";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function OrganizationsPage() {
  await requireRole(["developer_admin"]);
  const orgs = await listOrganizations();
  const { t } = await getT();
  return (
    <div>
      <PageHeader
        titleKey="headers.organizations_title"
        descKey="headers.organizations_desc"
      />
      {orgs.length === 0 ? (
        <EmptyState icon={Boxes} title={t("headers.organizations_no_orgs")} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tables.name")}</TableHead>
                <TableHead>{t("tables.slug")}</TableHead>
                <TableHead>{t("tables.contact")}</TableHead>
                <TableHead>{t("tables.status")}</TableHead>
                <TableHead className="text-right">{t("tables.created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{o.slug}</TableCell>
                  <TableCell className="text-muted-foreground">{o.contact_email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={o.status === "active" ? "success" : "muted"}>{t(`status.${o.status}` as TranslationKey)}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(o.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
