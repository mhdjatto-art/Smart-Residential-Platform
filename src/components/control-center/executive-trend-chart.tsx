"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyKpiRow } from "@/lib/api/analytics";
import { formatCurrency } from "@/lib/utils";

interface ExecutiveTrendChartProps {
  data: DailyKpiRow[];
  currency: string;
}

export function ExecutiveTrendChart({ data, currency }: ExecutiveTrendChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No trend data yet.</p>;
  }
  const series = data.map((d) => ({
    date: d.kpi_date.slice(5),
    Collections: Number(d.collections_today),
    Outstanding: Number(d.outstanding_balance),
    Overdue: Number(d.overdue_amount),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={series} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, { currency, compact: true })} width={80} />
        <Tooltip
          formatter={(v: number) => formatCurrency(v, { currency })}
          contentStyle={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))", fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="Collections" stroke="#10B981" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Outstanding" stroke="#0EA5E9" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Overdue"     stroke="#F43F5E" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
