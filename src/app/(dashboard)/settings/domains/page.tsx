import { redirect } from "next/navigation";
import { Globe } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DomainsForm } from "@/components/saas/domains-form";
import { DomainRowActions } from "@/components/saas/domain-row-actions";
import { requireRole, requireUser } from "@/lib/auth/guards";
import { listDomains } from "@/lib/api/saas";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function DomainsPage() {
  await requireRole(["super_admin","developer_admin"]);
  const user = await requireUser();
  const orgId = user.organizationIds[0];
  if (!orgId) redirect("/organizations");
  const domains = await listDomains(orgId);
  const { t } = await getT();

  return (
    <div>
      <PageHeader
        titleKey="headers.domains_title"
        descKey="headers.domains_desc"
      />
      <DomainsForm orgId={orgId} />

      <Card className="mt-6">
        <div className="px-4 pt-4 pb-2 text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Globe className="h-4 w-4" />{t("headers.configured_hosts")}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("tables.host")}</TableHead>
              <TableHead>{t("tables.primary")}</TableHead>
              <TableHead>{t("tables.ssl")}</TableHead>
              <TableHead>{t("tables.verified")}</TableHead>
              <TableHead className="text-right">{t("tables.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {domains.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">{t("headers.no_domains_yet")}</TableCell></TableRow>
            ) : (
              domains.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono">{d.host}</TableCell>
                  <TableCell>{d.is_primary ? t("common.yes") : "—"}</TableCell>
                  <TableCell className="text-xs uppercase">{d.ssl_status}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.verified_at ? new Date(d.verified_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="text-right"><DomainRowActions id={d.id} orgId={orgId} isPrimary={d.is_primary} /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
