import Link from "next/link";
import { Plug, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ProvidersBrowser } from "@/components/providers/providers-browser";
import { listProviders } from "@/lib/api/utilities";

export const dynamic = "force-dynamic";

export default async function ProvidersPage() {
  const providers = await listProviders();
  return (
    <div>
      <PageHeader
        title="Utility providers"
        description="Electricity, internet, gas, water, generators, gates, parking, access control. Filter by type, adapter, country, or category."
        actions={
          <Button asChild>
            <Link href="/providers/new"><Plus className="h-4 w-4" />Add provider</Link>
          </Button>
        }
      />
      {providers.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No providers yet"
          description="Add a utility provider to start managing services, or run the seed SQL files."
          action={<Button asChild><Link href="/providers/new">Add provider</Link></Button>}
        />
      ) : (
        <ProvidersBrowser providers={providers} />
      )}
    </div>
  );
}
