import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ThemeSettingsForm } from "@/components/theme/theme-settings-form";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Preferences" };
export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  await requireUser();
  return (
    <div>
      <PageHeader
        title="My preferences"
        description="Personalize your theme, accent color, and notification channels."
        titleKey="settings.prefs_title"
        descKey="settings.prefs_desc"
      />
      <div className="mx-auto max-w-2xl">
        <ThemeSettingsForm />
      </div>
    </div>
  );
}
