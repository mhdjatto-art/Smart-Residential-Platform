"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReceiptActions() {
  return (
    <div className="flex gap-2 print:hidden">
      <Button onClick={() => window.print()} variant="default">
        <Download className="h-4 w-4" /> Download / Print PDF
      </Button>
      <Button onClick={() => window.history.back()} variant="outline">
        Back
      </Button>
    </div>
  );
}

export function PrintIconButton() {
  return (
    <Button size="sm" variant="ghost" onClick={() => window.print()} className="print:hidden">
      <Printer className="h-4 w-4" /> Print
    </Button>
  );
}
