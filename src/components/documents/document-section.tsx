"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  deleteDocument,
  getDocumentSignedUrl,
  uploadDocument,
  type DocumentRow,
} from "@/lib/api/documents";
import { formatDate } from "@/lib/utils";

interface DocumentSectionProps {
  entityType: string;
  entityId: string;
  documents: DocumentRow[];
}

const KINDS = [
  "national_id", "passport", "ownership_deed", "lease_agreement",
  "sales_contract", "utility_bill", "other",
];

export function DocumentSection({ entityType, entityId, documents }: DocumentSectionProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("entity_type", entityType);
    fd.set("entity_id", entityId);

    startTransition(async () => {
      try {
        await uploadDocument(fd);
        toast.success("Document uploaded");
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error("Upload failed", { description: err instanceof Error ? err.message : "" });
      }
    });
  }

  async function open_(id: string) {
    try {
      const url = await getDocumentSignedUrl(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error("Could not open document", { description: e instanceof Error ? e.message : "" });
    }
  }

  function remove(id: string) {
    if (!confirm("Delete this document permanently?")) return;
    startTransition(async () => {
      try {
        await deleteDocument(id);
        toast.success("Document deleted");
        router.refresh();
      } catch (e) {
        toast.error("Delete failed", { description: e instanceof Error ? e.message : "" });
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Documents ({documents.length})</h3>
          <Button size="sm" onClick={() => setOpen((v) => !v)}>
            <Plus className="h-4 w-4" /> {open ? "Close" : "Upload"}
          </Button>
        </div>

        {open && (
          <form ref={formRef} onSubmit={onSubmit} className="space-y-3 rounded-md border bg-muted/30 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Document kind</Label>
                <Select name="kind" defaultValue="other" required>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>{k.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Expires at (optional)</Label>
                <Input type="date" name="expires_at" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>File (PDF or image, max 10MB)</Label>
                <Input type="file" name="file" accept="image/*,application/pdf" required />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Notes</Label>
                <Input name="notes" placeholder="optional" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Uploading…" : "Upload"}</Button>
            </div>
          </form>
        )}

        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.file_name}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{d.kind.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(d.expires_at)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(d.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => open_(d.id)} disabled={pending}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(d.id)} disabled={pending}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
