"use client";

import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  unitId: string;
  unitNumber: string;
  buildingName: string;
  compoundName: string;
  compoundCity: string;
  areaSqm: number | null;
  payload: string;
}

/**
 * QR sticker page for a unit. Produces a printable single-card layout that the
 * compound manager can stick on the unit's front door. Scanning routes to the
 * unit detail page via the payload `srp:unit:<uuid>`.
 *
 * QR generation: free api.qrserver.com endpoint — no npm package.
 */
export function UnitBarcodeClient({
  unitId,
  unitNumber,
  buildingName,
  compoundName,
  compoundCity,
  areaSqm,
  payload,
}: Props) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=12&data=${encodeURIComponent(payload)}`;

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .barcode-card, .barcode-card * { visibility: visible !important; }
          .barcode-card {
            position: absolute !important;
            left: 50% !important;
            top: 24px !important;
            transform: translateX(-50%) !important;
            box-shadow: none !important;
            border: 2px solid #000 !important;
            page-break-inside: avoid;
          }
          body { background: white !important; }
        }
      `}</style>

      <div className="print-hide mb-4 flex items-center justify-between">
        <Button asChild variant="outline" size="sm">
          <Link href={`/units/${unitId}`}>
            <ArrowLeft className="h-4 w-4" />Back
          </Link>
        </Button>

        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={qrUrl} download={`unit-${unitNumber}.png`}>
              <Download className="h-4 w-4" />Download QR
            </a>
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />Print sticker
          </Button>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="barcode-card flex w-[400px] flex-col items-center rounded-lg border-2 border-black bg-white p-6 text-black shadow-lg">
          <p className="text-xs uppercase tracking-widest text-gray-500">{compoundName}{compoundCity ? ` · ${compoundCity}` : ""}</p>
          <h1 className="mt-1 text-3xl font-bold">Unit {unitNumber}</h1>
          <p className="text-sm text-gray-700">{buildingName}{areaSqm ? ` · ${areaSqm} m²` : ""}</p>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt={`QR for unit ${unitNumber}`}
            width={320}
            height={320}
            className="my-4 rounded-md border bg-white"
          />

          <p className="font-mono text-[10px] tracking-tight text-gray-500">{payload}</p>
          <p className="mt-2 text-center text-[11px] text-gray-600">
            Scan with the SRP app — opens unit, tickets, contracts, residents.
          </p>
        </div>
      </div>
    </div>
  );
}
