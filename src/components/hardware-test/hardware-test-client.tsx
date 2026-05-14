"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2, Zap, Droplet, Flame, Wifi, Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ProviderRow {
  id:              string;
  provider_name:   string;
  provider_type:   string;
  provider_code:   string | null;
  adapter_kind:    string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter_config:  any;
  provider_status: string | null;
}

interface TestResult {
  outcome:    "connected" | "unreachable" | "auth_failed" | "simulated" | "misconfigured";
  message:    string;
  latencyMs?: number;
  details?:   Record<string, unknown>;
  error?:     string;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  electricity: Zap,
  water:       Droplet,
  gas:         Flame,
  internet:    Wifi,
  generator:   Zap,
};

const TYPE_LABELS: Record<string, string> = {
  electricity: "الكهرباء",
  water:       "الماء",
  gas:         "الغاز",
  internet:    "الإنترنت",
  generator:   "المولدات",
};

const KIND_LABELS: Record<string, string> = {
  rest:     "REST API",
  modbus:   "Modbus TCP",
  mqtt:     "MQTT Broker",
  mikrotik: "MikroTik RouterOS",
  unifi:    "UniFi Controller",
  radius:   "RADIUS Server",
  webhook:  "Webhook (incoming)",
  generic:  "Manual / Generic",
};

const OUTCOME_STYLE: Record<TestResult["outcome"], { color: string; Icon: typeof CheckCircle2; label: string }> = {
  connected:     { color: "text-emerald-600", Icon: CheckCircle2, label: "متصل بنجاح" },
  unreachable:   { color: "text-rose-600",    Icon: XCircle,      label: "غير قابل للاتصال" },
  auth_failed:   { color: "text-amber-600",   Icon: AlertTriangle,label: "فشل المصادقة" },
  simulated:     { color: "text-sky-600",     Icon: Info,         label: "وضع المحاكاة" },
  misconfigured: { color: "text-violet-600",  Icon: AlertTriangle,label: "إعدادات ناقصة" },
};

export function HardwareTestClient({ providers }: { providers: ProviderRow[] }) {
  const [search,  setSearch]  = useState("");
  const [type,    setType]    = useState<string>("all");
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<string | null>(null);

  const types = useMemo(() => {
    const s = new Set<string>();
    providers.forEach((p) => s.add(p.provider_type));
    return ["all", ...Array.from(s).sort()];
  }, [providers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return providers.filter((p) => {
      if (type !== "all" && p.provider_type !== type) return false;
      if (!q) return true;
      return (
        p.provider_name.toLowerCase().includes(q) ||
        (p.provider_code ?? "").toLowerCase().includes(q) ||
        (p.adapter_kind ?? "").toLowerCase().includes(q)
      );
    });
  }, [providers, search, type]);

  function runTest(providerId: string) {
    setRunning(providerId);
    startTransition(async () => {
      try {
        const res = await fetch("/api/hardware/test", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ providerId }),
        });
        const json = (await res.json()) as { result?: TestResult; error?: string };
        if (!res.ok || !json.result) {
          toast.error("فشل الاختبار", { description: json.error ?? `HTTP ${res.status}` });
        } else {
          setResults((prev) => ({ ...prev, [providerId]: json.result! }));
          const style = OUTCOME_STYLE[json.result.outcome];
          (json.result.outcome === "connected" ? toast.success : toast.info)(style.label, {
            description: json.result.message,
          });
        }
      } catch (e) {
        toast.error("فشل غير متوقع", {
          description: e instanceof Error ? e.message : "Unknown error",
        });
      } finally {
        setRunning(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Input
          placeholder="ابحث باسم المزوّد أو الكود..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                type === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-muted"
              }`}
            >
              {t === "all" ? "الكل" : (TYPE_LABELS[t] ?? t)}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} مزوّد. لاختبار جميع المزوّدين دفعة واحدة، انتظر دقيقة بين كل اختبار (الحد: 5/دقيقة لكل IP).
      </p>

      {/* Provider grid */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => {
          const Icon = TYPE_ICONS[p.provider_type] ?? Cpu;
          const result = results[p.id];
          const isRunning = running === p.id;
          return (
            <Card key={p.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate text-sm">{p.provider_name}</CardTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="muted" className="text-[10px]">
                        {TYPE_LABELS[p.provider_type] ?? p.provider_type}
                      </Badge>
                      <Badge variant="muted" className="text-[10px]">
                        {KIND_LABELS[p.adapter_kind ?? "generic"] ?? p.adapter_kind}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pb-3">
                {p.adapter_config?.endpoint && (
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    {String(p.adapter_config.endpoint)}
                  </p>
                )}

                {/* Test result */}
                {result && (
                  <div className="rounded-md border bg-muted/30 p-2">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const style = OUTCOME_STYLE[result.outcome];
                        const ResultIcon = style.Icon;
                        return (
                          <>
                            <ResultIcon className={`h-4 w-4 shrink-0 ${style.color}`} />
                            <span className={`text-xs font-semibold ${style.color}`}>
                              {style.label}
                            </span>
                            {result.latencyMs !== undefined && (
                              <span className="ms-auto text-[10px] text-muted-foreground tabular-nums">
                                {result.latencyMs} ms
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{result.message}</p>
                    {result.error && (
                      <p className="mt-1 font-mono text-[10px] text-rose-600">{result.error}</p>
                    )}
                  </div>
                )}

                <Button
                  size="sm"
                  variant={result?.outcome === "connected" ? "outline" : "default"}
                  className="w-full"
                  onClick={() => runTest(p.id)}
                  disabled={isRunning || pending}
                >
                  {isRunning ? (
                    <><Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />جاري الاختبار...</>
                  ) : result ? (
                    "إعادة الاختبار"
                  ) : (
                    "اختبر الاتصال"
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          لا يوجد مزوّدون يطابقون البحث. جرّب تبسيط الفلتر أو أضف مزوّد جديد من <code>/providers</code>.
        </p>
      )}
    </div>
  );
}
