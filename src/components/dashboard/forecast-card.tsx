"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { ForecastResult } from "@/server/ai/types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

export function ForecastCard({ forecast, currency, recentPoints }: { forecast: ForecastResult; currency: string; recentPoints: Array<{ label: string; revenue: number }> }) {
  const { t } = useI18n();
  const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);

  const actual = recentPoints.slice(-14).map((p) => ({ label: p.label, actual: p.revenue }));
  const projected = forecast.points.map((p) => ({ label: p.date.slice(5), projected: p.value }));
  const lastActual = actual[actual.length - 1]?.actual ?? 0;

  const TrendIcon = forecast.trend === "up" ? TrendingUp : forecast.trend === "down" ? TrendingDown : Minus;
  const trendGood = forecast.trend !== "down";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={cn("flex size-8 items-center justify-center rounded-lg", trendGood ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300")}>
          <TrendIcon className="size-4" />
        </span>
        <div>
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{t("dashboard.charts.nextDays", { count: String(forecast.horizonDays) })}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("dashboard.charts.predicted", { total: fmt(forecast.predictedTotal), growth: `${forecast.growthRate >= 0 ? "+" : ""}${(forecast.growthRate * 100).toFixed(1)}` })}
          </p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--chart-tick)" }} tickLine={false} axisLine={false} />
          <YAxis hide domain={[0, "dataMax + 200"]} />
          <Tooltip contentStyle={{ background: "var(--color-tooltip-bg, #ffffff)", border: "1px solid var(--chart-grid)", borderRadius: 8, fontSize: 12 }} formatter={(value: number, name: string) => [fmt(value), name === "actual" ? t("dashboard.charts.actual") : t("dashboard.charts.forecast")]} />
          <Line data={actual} dataKey="actual" name="actual" type="monotone" stroke="#64748b" strokeWidth={2} dot={false} isAnimationActive={false} />
          <ReferenceLine y={lastActual} stroke="var(--chart-grid)" strokeDasharray="4 4" />
          <Line data={projected} dataKey="projected" name="projected" type="monotone" stroke="#4f46e5" strokeWidth={2.5} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
