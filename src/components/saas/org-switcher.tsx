"use client";

/**
 * Tenant switcher used at the top of settings pages that scope by org.
 *
 * super_admin and developer_admin see this dropdown so they can hop
 * between tenants without typing UUIDs. compound_manager (who is always
 * pinned to one tenant) never sees it — the parent page hides the whole
 * component for non-privileged roles.
 *
 * On change, the component pushes `?org=<uuid>` and lets the server
 * component re-render with the new tenant.
 */
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface OrgSwitcherProps {
  orgs: { id: string; name: string; slug: string }[];
  activeOrgId:   string;
  activeOrgName: string;
}

export function OrgSwitcher({ orgs, activeOrgId, activeOrgName }: OrgSwitcherProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const search   = useSearchParams();

  function onChange(nextId: string) {
    if (nextId === activeOrgId) return;
    const params = new URLSearchParams(search.toString());
    params.set("org", nextId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>Editing branding for:</span>
          <span className="font-semibold text-foreground">{activeOrgName}</span>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Label htmlFor="org-switch" className="sr-only">Switch tenant</Label>
          <Select value={activeOrgId} onValueChange={onChange}>
            <SelectTrigger id="org-switch" className="w-full sm:w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
