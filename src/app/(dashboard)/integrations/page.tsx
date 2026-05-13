import Link from "next/link";
import { Cable, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { IntegrationsBrowser } from "@/components/integrations/integrations-browser";
import { listIntegrations } from "@/lib/api/pricing";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const integrations = await listIntegrations();
  return (
    <div>
      <PageHeader
        title="Provider integrations"
        titleKey="headers.integrations_title"
        description="Adapter configurations — Mikrotik, UniFi, Modbus, RADIUS, MQTT, REST, Webhook. Filter, search, and monitor health."
        descKey="headers.integrations_desc"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/integrations/logs">View logs</Link>
            </Button>
            <Button asChild>
              <Link href="/integrations/new"><Plus className="h-4 w-4" />New integration</Link>
            </Button>
          </div>
        }
      />
      {integrations.length === 0 ? (
        <EmptyState
          icon={Cable}
          title="No integrations configured"
          description="Connect a Mikrotik router, UniFi controller, Modbus meter, or any REST API to automate utility operations."
          action={<Button asChild><Link href="/integrations/new">New integration</Link></Button>}
        />
      ) : (
        <IntegrationsBrowser integrations={integrations} />
      )}
    </div>
  );
}
