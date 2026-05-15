"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Link2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createResidentInvite, revokeInvite, type InviteRow } from "@/lib/api/invites";
import { useT } from "@/lib/i18n/client";

interface Props {
  unitId: string;
  existing: InviteRow[];
}

export function InviteGenerator({ unitId, existing }: Props) {
  const router = useRouter();
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [tenancy, setTenancy] = useState<"owner" | "tenant" | "family_member" | "guest">("tenant");
  const [expiresDays, setExpiresDays] = useState(14);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);

  function create() {
    startTransition(async () => {
      try {
        await createResidentInvite({
          unit_id: unitId,
          email: email.trim() || undefined,
          tenancy_type: tenancy,
          expires_days: expiresDays,
        });
        toast.success(t("forms.toast_invite_created"));
        setEmail("");
        router.refresh();
      } catch (err) {
        toast.error(t("forms.toast_create_failed"), { description: err instanceof Error ? err.message : t("forms.unknown") });
      }
    });
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/signup?code=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(code);
      toast.success(t("forms.toast_link_copied"));
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function revoke(id: string) {
    if (!confirm(t("forms.confirm_revoke_invite"))) return;
    startTransition(async () => {
      try {
        await revokeInvite(id);
        toast.success(t("forms.toast_invite_revoked"));
        router.refresh();
      } catch (err) {
        toast.error(t("forms.toast_revoke_failed"), { description: err instanceof Error ? err.message : t("forms.unknown") });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" /> {t("forms.resident_invites_title")}
        </CardTitle>
        <CardDescription>
          {t("forms.resident_invites_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create form */}
        <div className="grid grid-cols-1 gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-4">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="inv-email">{t("forms.email_optional")}</Label>
            <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("forms.email_placeholder_resident")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inv-tenancy">{t("forms.tenancy")}</Label>
            <select
              id="inv-tenancy"
              className="flex h-10 w-full rounded-md border bg-background px-2 text-sm"
              value={tenancy} onChange={(e) => setTenancy(e.target.value as typeof tenancy)}
            >
              <option value="tenant">{t("forms.tenant")}</option>
              <option value="owner">{t("forms.owner")}</option>
              <option value="family_member">{t("forms.family_member")}</option>
              <option value="guest">{t("forms.guest")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="inv-days">{t("forms.expires_in_days")}</Label>
            <Input id="inv-days" type="number" min={1} max={60} value={expiresDays}
              onChange={(e) => setExpiresDays(Number(e.target.value) || 14)} />
          </div>
          <div className="sm:col-span-4">
            <Button onClick={create} disabled={pending} size="sm">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("forms.generate_invite")}
            </Button>
          </div>
        </div>

        {/* Existing invites */}
        {existing.length > 0 ? (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">{t("tables.code")}</th>
                  <th className="px-3 py-2 text-left">{t("tables.email")}</th>
                  <th className="px-3 py-2 text-left">{t("forms.tenancy")}</th>
                  <th className="px-3 py-2 text-left">{t("common.status")}</th>
                  <th className="px-3 py-2 text-left">{t("common.expires")}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {existing.map((i) => {
                  const used = !!i.used_at;
                  const expired = !used && new Date(i.expires_at) < new Date();
                  return (
                    <tr key={i.id} className="border-t">
                      <td className="px-3 py-2 font-mono">{i.code}</td>
                      <td className="px-3 py-2 text-muted-foreground">{i.email ?? "—"}</td>
                      <td className="px-3 py-2 capitalize text-muted-foreground">{i.tenancy_type.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                          used     ? "bg-emerald-100 text-emerald-800" :
                          expired  ? "bg-muted text-muted-foreground" :
                          "bg-amber-100 text-amber-800"
                        }`}>
                          {used ? t("forms.invite_status_used") : expired ? t("forms.invite_status_expired") : t("forms.invite_status_active")}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(i.expires_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!used && !expired && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => copyLink(i.code)} className="mr-1">
                              {copied === i.code ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              {copied === i.code ? t("forms.copied") : t("forms.copy_link")}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => revoke(i.id)}>
                              {t("forms.revoke")}
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-md border bg-muted/30 p-3 text-center text-xs text-muted-foreground">
            {t("forms.no_invites_yet")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
