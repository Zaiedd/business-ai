"use client";

import RingChart from "@/components/charts/ring-chart";
import Ring from "@/components/charts/ring";
import { RingCenter } from "@/components/charts/ring-center";
import { useI18n } from "@/components/i18n-provider";
import { stripBidi } from "@/lib/utils";

const PALETTE = ["var(--chart-1)", "var(--chart-4)", "var(--chart-2)", "var(--chart-3)", "#10b981", "#f59e0b", "#f43f5e", "#14b8a6", "#0ea5e9"];

export function ExpensePieChart({ data, currency }: { data: Array<{ category: string; amount: number }>; currency: string }) {
  const { locale } = useI18n();
  const top = data.slice(0, 7);
  const fmt = (v: number) =>
    stripBidi(
      new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(v)
    );
  const total = top.reduce((a, b) => a + b.amount, 0);
  const ringData = top.map((e, i) => ({
    label: e.category,
    value: e.amount,
    maxValue: Math.max(total, 1),
    color: PALETTE[i % PALETTE.length],
  }));

  return (
    <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2">
      <RingChart data={ringData} strokeWidth={14} ringGap={6} baseInnerRadius={70}>
        {top.map((e, i) => (
          <Ring key={e.category} index={i} />
        ))}
        <RingCenter
          defaultLabel=""
          formatOptions={{ style: "currency", currency, notation: "compact", maximumFractionDigits: 0 }}
        />
      </RingChart>
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