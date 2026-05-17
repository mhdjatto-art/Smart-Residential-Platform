"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScanLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { visitorSchema } from "@/lib/validations/operations";
import { createVisitor } from "@/lib/api/visitors";
import { useT } from "@/lib/i18n/client";
import { isNative, scanQrCode } from "@/lib/native/capacitor-bridge";

interface NewVisitorFormProps {
  residentId: string;
  unitId: string | null;
}

export function NewVisitorForm({ residentId, unitId }: NewVisitorFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { t } = useT();
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Phase 9 — show the QR scan button ONLY inside the Capacitor native shell.
  // We deliberately defer the isNative() check to useEffect so SSR and the
  // first client render stay identical (no hydration mismatch).
  const [showScan, setShowScan] = useState(false);
  const [scanning, setScanning] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setShowScan(isNative());
  }, []);

  /**
   * Tap-to-scan handler. Opens the native ML Kit barcode scanner and writes
   * the result into the form. Tries to recognise common payload shapes:
   *   - JSON `{ name, id, plate }` → fills three fields at once
   *   - Plain string → drops into the ID Number field
   *
   * On the web build this path isn't reachable (the button is hidden), but
   * `scanQrCode()` has a web-side BarcodeDetector fallback regardless.
   */
  async function handleScan() {
    if (scanning) return;
    setScanning(true);
    try {
      const raw = await scanQrCode();
      if (!raw) {
        toast.info("No QR code detected");
        return;
      }

      let filled = 0;
      const form = formRef.current;
      if (!form) return;

      // Try JSON first.
      try {
        const parsed = JSON.parse(raw) as { name?: string; id?: string; plate?: string };
        if (parsed && typeof parsed === "object") {
          const setField = (name: string, value: string | undefined): void => {
            if (!value) return;
            const el = form.elements.namedItem(name) as HTMLInputElement | null;
            if (el) {
              el.value = value;
              filled++;
            }
          };
          setField("full_name",     parsed.name);
          setField("id_number",     parsed.id);
          setField("vehicle_plate", parsed.plate);
        }
      } catch {
        // Not JSON — treat the whole string as an ID number.
        const idField = form.elements.namedItem("id_number") as HTMLInputElement | null;
        if (idField) {
          idField.value = raw;
          filled = 1;
        }
      }

      if (filled > 0) {
        toast.success("QR scanned");
      } else {
        toast.info("Unrecognised QR — please enter manually");
      }
    } catch (err) {
      console.warn("[visitor-form] scan failed", err);
      toast.error("Scan failed", { description: err instanceof Error ? err.message : "" });
    } finally {
      setScanning(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const candidate = {
      resident_id: residentId,
      unit_id: unitId ?? "",
      full_name: String(fd.get("full_name") ?? ""),
      mobile: String(fd.get("mobile") ?? ""),
      id_number: String(fd.get("id_number") ?? ""),
      vehicle_plate: String(fd.get("vehicle_plate") ?? ""),
      visitor_type: String(fd.get("visitor_type") ?? "guest"),
      visit_purpose: String(fd.get("visit_purpose") ?? ""),
      scheduled_date: String(fd.get("scheduled_date") ?? ""),
      scheduled_time: String(fd.get("scheduled_time") ?? ""),
      notes: "",
    };
    const parsed = visitorSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) next[k] = (v ?? [])[0]!;
      setErrors(next);
      return;
    }
    startTransition(async () => {
      try {
        await createVisitor(parsed.data);
        toast.success("Visitor pre-registered");
        router.push("/m/visitors");
        router.refresh();
      } catch (err) {
        toast.error("Failed", { description: err instanceof Error ? err.message : "" });
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate>
      {/* Phase 9 — native-only QR scan shortcut. Hidden on web/desktop. */}
      {showScan && (
        <Button
          type="button"
          variant="outline"
          onClick={handleScan}
          disabled={scanning}
          className="mb-3 w-full"
        >
          <ScanLine className="mr-2 h-4 w-4" />
          {scanning ? "Scanning…" : "Scan visitor QR"}
        </Button>
      )}
      <Card>
        <CardContent className="grid gap-4 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("mobile.visitor_name")}</Label>
            <Input name="full_name" required />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("mobile.date_field")}</Label>
              <Input name="scheduled_date" type="date" required />
              {errors.scheduled_date && <p className="text-xs text-destructive">{errors.scheduled_date}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("mobile.time")}</Label>
              <Input name="scheduled_time" type="time" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("mobile.type")}</Label>
            <Select name="visitor_type" defaultValue="guest">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="guest">Guest</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("mobile.mobile_field")}</Label>
            <Input name="mobile" type="tel" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("mobile.id_number")}</Label>
              <Input name="id_number" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("mobile.vehicle_plate")}</Label>
              <Input name="vehicle_plate" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("mobile.purpose")}</Label>
            <Textarea name="visit_purpose" rows={2} />
          </div>
        </CardContent>
      </Card>
      <Button type="submit" className="mt-4 w-full" disabled={pending}>{pending ? t("mobile.saving") : t("mobile.pre_register")}</Button>
    </form>
  );
}
