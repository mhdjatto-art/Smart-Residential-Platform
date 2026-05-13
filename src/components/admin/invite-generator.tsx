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

interface Props {
  unitId: string;
  existing: InviteRow[];
}

export function InviteGenerator({ unitId, existing }: Props) {
  const router = useRouter();
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
        toast.success("Invite created");
        setEmail("");
        router.refresh();
      } catch (err) {
        toast.error("Create failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/signup?code=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(code);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function revoke(id: string) {
    if (!confirm("Revoke this invite? The code will stop working immediately.")) return;
    startTransition(async () => {
      try {
        await revokeInvite(id);
        toast.success("Invite revoked");
        router.refresh();
      } catch (err) {
        toast.error("Revoke failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" /> Resident invites
        </CardTitle>
        <CardDescription>
          Generate a one-time invite link so a new resident can create their own account for this unit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create form */}
        <div className="grid grid-cols-1 gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-4">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="inv-email">Email (optional — locks to this address)</Label>
            <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="resident@example.com" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inv-tenancy">Tenancy</Label>
            <select
              id="inv-tenancy"
              className="flex h-10 w-full rounded-md border bg-background px-2 text-sm"
              value={tenancy} onChange={(e) => setTenancy(e.target.value as typeof tenancy)}
            >
              <option value="tenant">Tenant</option>
              <option value="owner">Owner</option>
              <option value="family_member">Family member</option>
              <option value="guest">Guest</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="inv-days">Expires in (days)</Label>
            <Input id="inv-days" type="number" min={1} max={60} value={expiresDays}
              onChange={(e) => setExpiresDays(Number(e.target.value) || 14)} />
          </div>
          <div className="sm:col-span-4">
            <Button onClick={create} disabled={pending} size="sm">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Generate invite
            </Button>
          </div>
        </div>

        {/* Existing invites */}
        {existing.length > 0 ? (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Tenancy</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Expires</th>
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
                          {used ? "used" : expired ? "expired" : "active"}
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
                              {copied === i.code ? "Copied" : "Copy link"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => revoke(i.id)}>
                              Revoke
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
            No invites yet for this unit.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
