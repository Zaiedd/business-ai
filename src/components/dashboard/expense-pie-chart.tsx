"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const PALETTE = ["#4f46e5", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#14b8a6", "#6366f1", "#a855f7"];

export function ExpensePieChart({ data, currency }: { data: Array<{ category: string; amount: number }>; currency: string }) {
  const top = data.slice(0, 7);
  const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const total = top.reduce((a, b) => a + b.amount, 0);

  return (
    <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={top} dataKey="amount" nameKey="category" innerRadius={52} outerRadius={84} paddingAngle={2} strokeWidth={1}>
            {top.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number, name: string) => [fmt(value), name]} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="space-y-1.5">
        {top.map((e, i) => (
          <li key={e.category} className="flex items-center gap-2 text-xs">
            <span className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-400">{e.category}</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{fmt(e.amount)}</span>
            <span className="w-10 text-right text-slate-400 dark:text-slate-500">{total > 0 ? ((e.amount / total) * 100).toFixed(0) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
