"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/components/i18n-provider";
import { stripBidi } from "@/lib/utils";

function ChartTooltip({ active, payload, label, currency }: any) {
  const { t, locale } = useI18n();
  if (!active || !payload?.length) return null;
  const nameMap: Record<string, string> = {
    revenue: t("dashboard.charts.revenue"),
    expenses: t("dashboard.charts.expenses"),
    profit: t("dashboard.charts.netProfit"),
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <span className="inline-block size-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          <span>{nameMap[p.dataKey] ?? p.name}:</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {stripBidi(new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(p.value))}
          </span>
        </p>
      ))}
    </div>
  );
}

export function RevenueTrendChart({ data, currency }: { data: Array<{ label: string; revenue: number; expenses: number; profit: number }>; currency: string }) {
  const { t } = useI18n();
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--chart-tick)" }} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} interval="preserveStartEnd" minTickGap={32} />
        <YAxis tick={{ fontSize: 11, fill: "var(--chart-tick)" }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
        <Tooltip content={<ChartTooltip currency={currency} />} />
        <Area type="monotone" dataKey="revenue" name={t("dashboard.charts.revenue")} stroke="#2563eb" strokeWidth={2} fill="url(#gRev)" />
        <Area type="monotone" dataKey="expenses" name={t("dashboard.charts.expenses")} stroke="#f43f5e" strokeWidth={2} fill="url(#gExp)" />
        <Area type="monotone" dataKey="profit" name={t("dashboard.charts.netProfit")} stroke="#10b981" strokeWidth={2} fill="transparent" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
