import Link from "next/link";
import { Star, Store } from "lucide-react";
import { MobileTopbar } from "@/components/mobile/topbar";
import { listServiceProviders } from "@/lib/api/marketplace";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const KIND_GROUPS: { title: string; kinds: string[] }[] = [
  { title: "Home services", kinds: ["maintenance","plumbing","electrician","ac_technician","cleaning"] },
  { title: "Food & groceries", kinds: ["grocery","restaurant","delivery"] },
  { title: "Wellbeing & errands", kinds: ["pharmacy","laundry","car_wash","moving"] },
  { title: "Other", kinds: ["security","internet_services","other"] },
];

export default async function MobileMarketplacePage() {
  const ctx = await getResidentContext();
  const providers = (await listServiceProviders()).filter((p) => p.is_active);
  const { t } = await getT();

  return (
    <div>
      <MobileTopbar title={t("headers.marketplace_title")} userId={ctx.user_id} unread={0} />
      <div className="p-4 space-y-5">
        <Link href="/m/marketplace/orders" className="block rounded-xl border bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          {t("mobile.my_orders")} →
        </Link>

        {providers.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Store className="mx-auto h-8 w-8 opacity-50" />
            <p className="mt-2">No providers in your compound yet.</p>
          </div>
        ) : (
          KIND_GROUPS.map((group) => {
            const list = providers.filter((p) => group.kinds.includes(p.provider_kind));
            if (list.length === 0) return null;
            return (
              <section key={group.title}>
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{group.title}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {list.map((p) => (
                    <Link key={p.id} href={`/m/marketplace/providers/${p.id}`} className="rounded-xl border bg-card p-3">
                      <p className="truncate text-sm font-medium">{p.provider_name}</p>
                      <p className="text-[11px] capitalize text-muted-foreground">{p.provider_kind.replace("_", " ")}</p>
                      {p.rating_count > 0 ? (
                        <p className="mt-1 flex items-center gap-1 text-xs">
                          <Star className="h-3 w-3 fill-amber-400 stroke-amber-500" />
                          <span>{p.rating_avg.toFixed(1)}</span>
                          <span className="text-muted-foreground">({p.rating_count})</span>
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-muted-foreground">No reviews</p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
