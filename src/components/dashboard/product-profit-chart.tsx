"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/components/i18n-provider";

export function ProductProfitChart({ data, currency }: { data: Array<{ name: string; profit: number; revenue: number }>; currency: string }) {
  const { t } = useI18n();
  const sorted = [...data].sort((a, b) => b.profit - a.profit).slice(0, 6);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "var(--chart-tick)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "var(--chart-tick-strong)" }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "rgba(79,70,229,0.06)" }}
          formatter={(value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value)}
        />
        <Bar dataKey="profit" name={t("dashboard.charts.profit")} fill="#4f46e5" radius={[0, 6, 6, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
