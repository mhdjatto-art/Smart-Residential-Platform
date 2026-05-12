"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { domainSchema } from "@/lib/validations/saas";
import { addDomain } from "@/lib/api/saas";

export function DomainsForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [host, setHost] = useState("");

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = domainSchema.safeParse({ organization_id: orgId, host, is_primary: false });
    if (!parsed.success) {
      toast.error("Invalid host", { description: parsed.error.errors[0]?.message });
      return;
    }
    startTransition(async () => {
      try {
        await addDomain(parsed.data);
        toast.success("Domain added");
        setHost("");
        router.refresh();
      } catch (err) {
        toast.error("Failed", { description: err instanceof Error ? err.message : "" });
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Add a hostname</Label>
            <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="portal.client.com" />
          </div>
          <Button type="submit" disabled={pending}>
            <Plus className="h-4 w-4" />{pending ? "Adding…" : "Add"}
          </Button>
        </form>
        <p className="mt-3 text-[11px] text-muted-foreground">
          After adding, point a CNAME from your DNS to <code className="font-mono">cname.srp.app</code>.
          SSL is issued automatically once the CNAME resolves.
        </p>
      </CardContent>
    </Card>
  );
}
