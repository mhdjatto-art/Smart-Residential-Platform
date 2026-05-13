"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDocumentSignedUrl } from "@/lib/api/documents";

export function DocumentDownloadButton({ docId, fileName }: { docId: string; fileName: string }) {
  const [pending, startTransition] = useTransition();

  function go() {
    startTransition(async () => {
      try {
        const url = await getDocumentSignedUrl(docId);
        // Trigger browser download
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err) {
        toast.error("Download failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={go} disabled={pending} className="h-7 px-2 text-xs">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      Download
    </Button>
  );
}
