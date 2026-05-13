"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface TemplateOption {
  id: string;
  name: string;
  locale: string;
}

interface Props {
  contractId: string;
  contractNumber: string;
  html: string;
  templates: TemplateOption[];
  currentTemplateId: string;
}

/**
 * Renders the rendered contract HTML in a printable container.
 *
 * Features:
 *  - "Edit" toggle makes the body contentEditable — user can tweak before printing.
 *  - "Print" calls window.print() — print-only CSS hides the toolbar so just the
 *    contract body lands on paper.
 *  - Template switcher reloads the page with ?template=ID.
 */
export function ContractPrintClient({
  contractId,
  contractNumber,
  html,
  templates,
  currentTemplateId,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(html);
  const ref = useRef<HTMLDivElement>(null);

  function onSwitchTemplate(id: string) {
    if (id === currentTemplateId) return;
    window.location.href = `/contracts/${contractId}/print?template=${id}`;
  }

  function onPrint() {
    if (editing && ref.current) {
      setBody(ref.current.innerHTML);
      setEditing(false);
      // give React a tick to re-render before printing
      setTimeout(() => window.print(), 50);
      return;
    }
    window.print();
  }

  return (
    <div>
      {/* Print-only stylesheet — hide everything except the paper itself */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-paper, .print-paper * { visibility: visible !important; }
          .print-paper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 24px !important;
          }
          body { background: white !important; }
        }
        .print-paper h1 { font-size: 28px; }
        .print-paper h2 { font-size: 18px; margin-top: 18px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
        .print-paper ul { padding-inline-start: 24px; }
        .print-paper li { margin-bottom: 4px; }
        .print-paper p { margin: 6px 0; line-height: 1.5; }
      `}</style>

      {/* Toolbar */}
      <div className="print-hide sticky top-0 z-10 flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href={`/contracts/${contractId}`}>
              <ArrowLeft className="h-4 w-4" />Back
            </Link>
          </Button>
          <div>
            <p className="text-sm font-medium">Contract {contractNumber}</p>
            <p className="text-xs text-muted-foreground">{editing ? "Edit mode — click outside fields to apply" : "Preview"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={currentTemplateId} onValueChange={onSwitchTemplate}>
            <SelectTrigger className="h-9 w-56">
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} <span className="ml-2 text-[10px] uppercase text-muted-foreground">{t.locale}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant={editing ? "default" : "outline"}
            onClick={() => {
              if (editing && ref.current) setBody(ref.current.innerHTML);
              setEditing(!editing);
            }}
          >
            {editing ? <Save className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {editing ? "Done editing" : "Edit"}
          </Button>

          <Button size="sm" onClick={onPrint}>
            <Printer className="h-4 w-4" />Print
          </Button>
        </div>
      </div>

      {/* Paper */}
      <div className="mx-auto my-6 max-w-[800px] px-4">
        <div
          ref={ref}
          contentEditable={editing}
          suppressContentEditableWarning
          className={`print-paper rounded-lg border bg-white p-12 text-[14px] text-black shadow-lg outline-none ${editing ? "ring-2 ring-primary/50" : ""}`}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </div>
    </div>
  );
}
