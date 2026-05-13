"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  data: Array<{ month: string; electricity: number; water: number }>;
}

export function UtilityChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
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
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area type="monotone" dataKey="electricity" stroke="#f59e0b" fill="#fde68a" name="Electricity (kWh)" />
        <Area type="monotone" dataKey="water"       stroke="#06b6d4" fill="#a5f3fc" name="Water (m³)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
