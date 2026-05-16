import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { GatewayManagerClient } from "@/components/master/gateway-manager-client";
import { listGateways } from "@/lib/api/gateway-manager";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Payment Gateways" };
export const dynamic = "force-dynamic";

export default async function GatewayManagerPage() {
  await requireRole(["super_admin", "developer_admin"]);
  const gateways = await listGateways();
  return (
    <div>
      <PageHeader
        title="Payment Gateways"
        description="Add, configure, enable or disable payment providers without touching code. Credentials are stored encrypted."
        titleKey="gateways.page_title"
        descKey="gateways.page_desc"
      />
      <GatewayManagerClient initial={gateways} />
    </div>
  );
}
