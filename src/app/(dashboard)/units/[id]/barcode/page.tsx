import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUnit } from "@/lib/api/units";
import { createClient } from "@/lib/supabase/server";
import { UnitBarcodeClient } from "@/components/units/unit-barcode-client";

export const metadata: Metadata = { title: "Unit barcode" };
export const dynamic = "force-dynamic";

export default async function UnitBarcodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const unit = await getUnit(id);
  if (!unit) notFound();

  const supabase = await createClient();
  const [buildingRes, compoundRes] = await Promise.all([
    supabase.from("buildings").select("name").eq("id", unit.building_id).maybeSingle(),
    supabase.from("compounds").select("name, city").eq("id", unit.compound_id).maybeSingle(),
  ]);

  const buildingName = (buildingRes.data as { name?: string } | null)?.name ?? "—";
  const compoundData = compoundRes.data as { name?: string; city?: string } | null;

  // Stable canonical code. Including the unit UUID guarantees uniqueness across
  // every compound; the scanner just routes /units/<uuid> based on the payload.
  const payload = `srp:unit:${unit.id}`;

  return (
    <UnitBarcodeClient
      unitId={unit.id}
      unitNumber={unit.unit_number}
      buildingName={buildingName}
      compoundName={compoundData?.name ?? "—"}
      compoundCity={compoundData?.city ?? ""}
      areaSqm={unit.area_sqm ?? null}
      payload={payload}
    />
  );
}
