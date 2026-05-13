import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listContractTemplates, renderContract } from "@/lib/api/contract-templates";
import { getContract } from "@/lib/api/contracts";
import { ContractPrintClient } from "@/components/contracts/contract-print-client";
import { getActiveBranding } from "@/components/layout/branding-provider";

export const metadata: Metadata = { title: "Print contract" };
export const dynamic = "force-dynamic";

export default async function PrintContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string; locale?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const contract = await getContract(id);
  if (!contract) notFound();

  // Map contract_type → template kind. installment_contracts.contract_type values:
  //   property_sale | lease_to_own | rental → use directly
  // Default to "property_sale" if unknown.
  const requestedKind = contract.contract_type ?? "property_sale";
  const templates = await listContractTemplates({ kind: requestedKind });

  // Fall back to ALL templates if none of this kind exist
  const available = templates.length > 0 ? templates : await listContractTemplates();

  if (available.length === 0) {
    return (
      <div className="p-8">
        <p className="mb-4 text-sm text-muted-foreground">
          No contract templates installed. Run <code className="font-mono">install-contract-templates.sql</code> in the Supabase SQL editor first.
        </p>
        <Button asChild variant="outline">
          <Link href={`/contracts/${id}`}><ArrowLeft className="h-4 w-4" />Back</Link>
        </Button>
      </div>
    );
  }

  // Pick the requested template; otherwise the first default; otherwise the first.
  const wantId = sp.template;
  const wantLocale = sp.locale;
  let chosen = wantId ? available.find((t) => t.id === wantId) : undefined;
  if (!chosen && wantLocale) chosen = available.find((t) => t.locale === wantLocale && t.is_default) ?? available.find((t) => t.locale === wantLocale);
  if (!chosen) chosen = available.find((t) => t.is_default) ?? available[0];

  const { html } = await renderContract(id, chosen.id);
  const branding = await getActiveBranding(contract.organization_id);

  return (
    <ContractPrintClient
      contractId={id}
      contractNumber={contract.contract_number}
      html={html}
      templates={available.map((t) => ({ id: t.id, name: t.name, locale: t.locale }))}
      currentTemplateId={chosen.id}
      logoUrl={branding?.logo_path ?? null}
      primaryColor={branding?.primary_color ?? null}
      emailFooter={branding?.email_footer ?? null}
    />
  );
}
