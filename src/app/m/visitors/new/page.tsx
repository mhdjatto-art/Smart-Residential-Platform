import { redirect } from "next/navigation";
import { MobileTopbar } from "@/components/mobile/topbar";
import { NewVisitorForm } from "@/components/mobile/new-visitor-form";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function NewVisitorPage() {
  const ctx = await getResidentContext();
  if (!ctx.resident_id) redirect("/m");
  const { t } = await getT();
  return (
    <div>
      <MobileTopbar title={t("headers.new_visitor_title")} userId={ctx.user_id} unread={0} showBack />
      <div className="p-4">
        <NewVisitorForm residentId={ctx.resident_id} unitId={ctx.unit_id} />
      </div>
    </div>
  );
}
