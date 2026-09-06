"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useI18n } from "@/components/i18n-provider";
import { stripBidi } from "@/lib/utils";

const PALETTE = ["#2563eb", "#1e40af", "#38bdf8", "#10b981", "#f59e0b", "#f43f5e", "#14b8a6", "#1d4ed8", "#0ea5e9"];

export function ExpensePieChart({ data, currency }: { data: Array<{ category: string; amount: number }>; currency: string }) {
  const { locale } = useI18n();
  const top = data.slice(0, 7);
  const fmt = (v: number) => stripBidi(new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(v));
  const total = top.reduce((a, b) => a + b.amount, 0);

  return (
    <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={top} dataKey="amount" nameKey="category" innerRadius="55%" outerRadius="90%" paddingAngle={2} strokeWidth={1}>
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
            <span className="w-10 text-end text-slate-400 dark:text-slate-500">{total > 0 ? ((e.amount / total) * 100).toFixed(0) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
