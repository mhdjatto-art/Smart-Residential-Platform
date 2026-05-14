import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { HardwareTestClient } from "@/components/hardware-test/hardware-test-client";

export const metadata: Metadata = { title: "Hardware Testing" };
export const dynamic = "force-dynamic";

interface ProviderRow {
  id:             string;
  provider_name:  string;
  provider_type:  string;
  provider_code:  string | null;
  adapter_kind:   string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter_config: any;
  provider_status: string | null;
}

export default async function HardwareTestPage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const supabase = await createClient();

  // Pull every provider known to the org, grouped by type for the UI.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: providers } = await (supabase as any)
    .from("utility_providers")
    .select("id, provider_name, provider_type, provider_code, adapter_kind, adapter_config, provider_status")
    .order("provider_type", { ascending: true })
    .order("provider_name", { ascending: true });

  const rows = (providers ?? []) as ProviderRow[];

  return (
    <div>
      <PageHeader
        title="اختبار الأجهزة والمزوّدين"
        description="اختر مزوّد خدمة من القائمة لاختبار اتصاله بدون أي تأثير على البيانات. يدعم MikroTik، UniFi، Modbus TCP، MQTT، REST، RADIUS، Webhooks."
      />
      <HardwareTestClient providers={rows} />
    </div>
  );
}
