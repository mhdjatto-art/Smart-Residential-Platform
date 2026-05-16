"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { placeOrderSchema } from "@/lib/validations/marketplace";
import { placeOrder } from "@/lib/api/marketplace";
import { formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

interface ProviderOption { id: string; name: string; }
interface ItemOption { id: string; name: string; price: number; currency: string; provider_id: string; }
interface ResidentOption { id: string; name: string; }

interface PlaceOrderFormProps {
  providers: ProviderOption[];
  items: ItemOption[];
  residents: ResidentOption[];
}

interface LineRow {
  service_item_id?: string;
  item_name: string;
  quantity: number;
  unit_price: number;
}

export function PlaceOrderForm({ providers, items, residents }: PlaceOrderFormProps) {
  const router = useRouter();
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [providerId, setProviderId] = useState<string>(providers[0]?.id ?? "");
  const [residentId, setResidentId] = useState<string>(residents[0]?.id ?? "");
  const [currency, setCurrency] = useState<string>("IQD");
  const [lines, setLines] = useState<LineRow[]>([{ item_name: "", quantity: 1, unit_price: 0 }]);
  const [serviceFee, setServiceFee] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const providerItems = useMemo(() => items.filter((i) => i.provider_id === providerId), [items, providerId]);

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const total = subtotal + Number(serviceFee || 0) + Number(deliveryFee || 0) + Number(taxAmount || 0);

  function addLine() {
    setLines((prev) => [...prev, { item_name: "", quantity: 1, unit_price: 0 }]);
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }
  function pickItem(idx: number, serviceItemId: string) {
    const item = providerItems.find((p) => p.id === serviceItemId);
    if (!item) return;
    setLines((prev) => prev.map((l, i) => i === idx ? {
      service_item_id: item.id,
      item_name: item.name,
      quantity: l.quantity || 1,
      unit_price: item.price,
    } : l));
    setCurrency(item.currency);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lines.length === 0 || lines.every((l) => !l.item_name.trim())) {
      toast.error(t("forms.toast_add_at_least_one"));
      return;
    }
    const candidate = {
      provider_id: providerId,
      resident_id: residentId,
      items: lines.filter((l) => l.item_name.trim()).map((l) => ({
        service_item_id: l.service_item_id ?? "",
        item_name: l.item_name,
        quantity: l.quantity,
        unit_price: l.unit_price,
      })),
      service_fee: Number(serviceFee || 0),
      delivery_fee: Number(deliveryFee || 0),
      tax_amount: Number(taxAmount || 0),
      currency,
      scheduled_for: "",
      delivery_address: deliveryAddress,
      delivery_notes: "",
      notes,
      compound_id: "",
      unit_id: "",
    };
    const parsed = placeOrderSchema.safeParse(candidate);
    if (!parsed.success) {
      toast.error(t("forms.toast_invalid_order"), { description: parsed.error.errors[0]?.message });
      return;
    }
    startTransition(async () => {
      try {
        const id = await placeOrder(parsed.data);
        toast.success(t("forms.toast_order_placed"));
        router.push(`/orders/${id}`);
        router.refresh();
      } catch (err) {
        toast.error(t("forms.toast_failed"), { description: err instanceof Error ? err.message : "" });
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Card>
        <CardHeader><CardTitle>{t("forms.order_header")}</CardTitle></CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("forms.provider")}</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("forms.resident")}</Label>
            <Select value={residentId} onValueChange={setResidentId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {residents.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("forms.currency")}</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="IQD">IQD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="SAR">SAR</SelectItem>
                <SelectItem value="AED">AED</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("forms.items_card")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {lines.map((l, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-3 items-end border-b pb-3">
              <div className="col-span-12 md:col-span-4 space-y-1">
                <Label className="text-xs">{t("forms.catalog_item_optional")}</Label>
                <Select
                  value={l.service_item_id ?? "__custom__"}
                  onValueChange={(v) => v === "__custom__"
                    ? setLines((prev) => prev.map((row, i) => i === idx ? { ...row, service_item_id: undefined } : row))
                    : pickItem(idx, v)}
                >
                  <SelectTrigger><SelectValue placeholder={t("forms.pick_from_catalog")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__custom__">{t("forms.custom_line_item")}</SelectItem>
                    {providerItems.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {formatCurrency(p.price, { currency: p.currency })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-12 md:col-span-3 space-y-1">
                <Label className="text-xs">{t("forms.name")}</Label>
                <Input
                  value={l.item_name}
                  onChange={(e) => setLines((prev) => prev.map((row, i) => i === idx ? { ...row, item_name: e.target.value } : row))}
                  required
                />
              </div>
              <div className="col-span-4 md:col-span-2 space-y-1">
                <Label className="text-xs">{t("forms.qty")}</Label>
                <Input
                  type="number" step="0.01" min="0.001"
                  value={l.quantity}
                  onChange={(e) => setLines((prev) => prev.map((row, i) => i === idx ? { ...row, quantity: Number(e.target.value) } : row))}
                />
              </div>
              <div className="col-span-6 md:col-span-2 space-y-1">
                <Label className="text-xs">{t("forms.unit_price")}</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={l.unit_price}
                  onChange={(e) => setLines((prev) => prev.map((row, i) => i === idx ? { ...row, unit_price: Number(e.target.value) } : row))}
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(idx)} disabled={lines.length === 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-4 w-4" />{t("forms.add_line")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("forms.fees_delivery")}</CardTitle></CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("forms.service_fee")}</Label>
            <Input type="number" step="0.01" min="0" value={serviceFee} onChange={(e) => setServiceFee(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>{t("forms.delivery_fee")}</Label>
            <Input type="number" step="0.01" min="0" value={deliveryFee} onChange={(e) => setDeliveryFee(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>{t("forms.tax")}</Label>
            <Input type="number" step="0.01" min="0" value={taxAmount} onChange={(e) => setTaxAmount(Number(e.target.value))} />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>{t("forms.delivery_address")}</Label>
            <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
          </div>
          <div className="md:col-span-3 space-y-2">
            <Label>{t("forms.notes")}</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-md ml-auto">
        <CardContent className="p-4 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">{t("forms.subtotal")}</span><span>{formatCurrency(subtotal, { currency })}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("forms.service_fee")}</span><span>{formatCurrency(serviceFee, { currency })}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("forms.delivery_fee")}</span><span>{formatCurrency(deliveryFee, { currency })}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("forms.tax")}</span><span>{formatCurrency(taxAmount, { currency })}</span></div>
          <div className="flex justify-between border-t pt-2 font-semibold"><span>{t("forms.total_label")}</span><span>{formatCurrency(total, { currency })}</span></div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>{t("actions.cancel")}</Button>
        <Button type="submit" disabled={pending}>{pending ? t("forms.placing") : t("forms.place_order")}</Button>
      </div>
    </form>
  );
}
