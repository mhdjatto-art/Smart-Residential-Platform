"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  data: Array<{ month: string; installments: number; utilities: number }>;
}

export function RevenueChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number) => `$${v.toLocaleString()}`}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="installments" fill="#10b981" name="Installments" radius={[6, 6, 0, 0]} />
        <Bar dataKey="utilities"    fill="#3b82f6" name="Utilities"    radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
