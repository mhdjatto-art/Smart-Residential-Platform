import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, FileText } from "lucide-react";
import { MobileTopbar } from "@/components/mobile/topbar";
import { getResidentContext } from "@/lib/api/resident-mobile";
import { getContract } from "@/lib/api/contracts";
import { listContractTemplates, renderContract } from "@/lib/api/contract-templates";
import { getLatestSignature } from "@/lib/api/contract-signatures";
import { MobileContractSignerClient } from "@/components/contracts/mobile-contract-signer";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Contract" };
export const dynamic = "force-dynamic";

export default async function MobileContractDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getResidentContext();
  const { t } = await getT();

  const contract = await getContract(id);
  if (!contract) notFound();

  // Verify the contract belongs to the resident (RLS will also enforce, but
  // we surface a friendly error rather than a 403)
  if (contract.resident_id !== ctx.resident_id) {
    return (
      <div>
        <MobileTopbar title={t("mobile.contract_title")} userId={ctx.user_id} unread={0} showBack />
        <div className="p-4">
          <p className="text-sm text-destructive">{t("mobile.contract_not_yours")}</p>
          <Link href="/m/contracts" className="mt-3 inline-block text-sm underline">{t("mobile.contract_back")}</Link>
        </div>
      </div>
    );
  }

  const existing = await getLatestSignature(id);
  const requestedKind = contract.contract_type ?? "property_sale";
  const templates = await listContractTemplates({ kind: requestedKind });
  const available = templates.length > 0 ? templates : await listContractTemplates();
  const chosen = available.find((tpl) => tpl.is_default) ?? available[0];

  if (!chosen) {
    return (
      <div>
        <MobileTopbar title={t("mobile.contract_title")} userId={ctx.user_id} unread={0} showBack />
        <div className="p-4 text-sm text-muted-foreground">
          {t("mobile.contract_no_template")}
        </div>
      </div>
    );
  }

  const { html } = await renderContract(id, chosen.id);

  return (
    <div>
      <MobileTopbar title={t("mobile.contract_label", { number: contract.contract_number })} userId={ctx.user_id} unread={0} showBack />
      <div className="p-4 space-y-4">
        {existing ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
              <p className="text-sm font-medium text-emerald-900">{t("mobile.contract_signed_on", { date: formatDate(existing.signed_at) })}</p>
            </div>
            {existing.full_name_typed && (
              <p className="mt-1 text-xs text-emerald-900/80">{t("mobile.contract_signed_by", { name: existing.full_name_typed })}</p>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={existing.signature_png}
              alt={t("mobile.contract_your_signature_alt")}
              className="mt-2 max-h-24 rounded border border-emerald-300 bg-white p-1"
            />
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-700" />
              <p className="text-sm font-medium text-amber-900">
                {t("mobile.contract_please_read")}
              </p>
            </div>
          </div>
        )}

        <MobileContractSignerClient
          contractId={id}
          templateId={chosen.id}
          html={html}
          alreadySigned={!!existing}
          residentDisplayName={ctx.full_name ?? ""}
        />
      </div>
    </div>
  );
}
