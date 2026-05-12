import { redirect } from "next/navigation";
import { MobileTopbar } from "@/components/mobile/topbar";
import { NewComplaintForm } from "@/components/mobile/new-complaint-form";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function NewMobileComplaintPage() {
  const ctx = await getResidentContext();
  if (!ctx.resident_id || !ctx.compound_id) redirect("/m");
  const { t } = await getT();
  return (
    <div>
      <MobileTopbar title={t("headers.new_complaint_title")} userId={ctx.user_id} unread={0} showBack />
      <div className="p-4">
        <NewComplaintForm compoundId={ctx.compound_id} residentId={ctx.resident_id} unitId={ctx.unit_id} />
      </div>
    </div>
  );
}
