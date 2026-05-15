import type { Metadata } from "next";
import { MobileTopbar } from "@/components/mobile/topbar";
import { ThemeSettingsForm } from "@/components/theme/theme-settings-form";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Preferences" };
export const dynamic = "force-dynamic";

export default async function MobilePreferencesPage() {
  const ctx = await getResidentContext();
  const { t } = await getT();
  return (
    <div>
      <MobileTopbar title={t("settings.prefs_title")} userId={ctx.user_id} unread={0} showBack />
      <div className="p-4">
        <ThemeSettingsForm />
      </div>
    </div>
  );
}
