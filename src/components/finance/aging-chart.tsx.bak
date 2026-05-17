"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { AgingBucket } from "@/lib/api/finance-charts";

interface AgingChartProps {
  data: AgingBucket[];
  currency?: string;
}

const COLORS = [
  "hsl(152 64% 38%)",     // emerald  — current
  "hsl(45 90% 55%)",      // amber-ish — 1-30
  "hsl(28 85% 55%)",      // orange   — 31-60
  "hsl(15 85% 55%)",      // red-orange — 61-90
  "hsl(0 72% 50%)",       // destructive — 90+
];

export function AgingChart({ data, currency = "USD" }: AgingChartProps) {
  const compactFmt = (n: number) =>
    new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={compactFmt}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, _name, item) => {
              const count = (item.payload as AgingBucket).count;
              return [`${formatCurrency(value, { currency })} · ${count} installment(s)`, "Amount"];
            }}
          />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
            {data.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx] ?? COLORS[0]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
