import { WifiOff } from "lucide-react";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function OfflinePage() {
  const { t } = await getT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <WifiOff className="h-12 w-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">{t("common.offline_title")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("common.offline_body")}</p>
      <a href="/m" className="rounded-md bg-emerald-500 text-white px-4 py-2 text-sm font-semibold">{t("actions.try_again")}</a>
    </div>
  );
}
