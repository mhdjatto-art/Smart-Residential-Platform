import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { PlaceOrderForm } from "@/components/marketplace/place-order-form";
import { requireRole } from "@/lib/auth/guards";
import { listServiceProviders, listServiceItems } from "@/lib/api/marketplace";
import { listResidentOptions } from "@/lib/api/residents";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  await requireRole(["super_admin", "developer_admin", "compound_manager", "finance_officer", "maintenance_staff"]);
  const [providers, items, residents] = await Promise.all([
    listServiceProviders(),
    listServiceItems(),
    listResidentOptions(),
  ]);
  if (providers.length === 0) redirect("/service-providers");
  if (residents.length === 0) redirect("/residents");

  return (
    <div>
      <PageHeader titleKey="ops.new_order_title" descKey="ops.new_order_desc" />
      <PlaceOrderForm
        providers={providers.map((p) => ({ id: p.id, name: p.provider_name }))}
        items={items.map((i) => ({ id: i.id, name: i.name, price: Number(i.price), currency: i.currency, provider_id: i.provider_id }))}
        residents={residents.map((r) => ({ id: r.id, name: r.full_name }))}
      />
    </div>
  );
}
