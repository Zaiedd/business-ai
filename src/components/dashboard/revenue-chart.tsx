"use client";

import { Area, AreaChart } from "@/components/charts/area-chart";
import { ChartTooltip } from "@/components/charts/tooltip";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { useI18n } from "@/components/i18n-provider";
import { stripBidi } from "@/lib/utils";

export function RevenueTrendChart({ data, currency }: { data: Array<{ label: string; date?: string; revenue: number; expenses: number; profit: number }>; currency: string }) {
  const { t, locale } = useI18n();
  const series = data.map((p) => ({ ...p, date: new Date(p.date ?? p.label) }));

  const fmt = (v: number) =>
    stripBidi(
      new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(v)
    );

  const rows = (point: Record<string, unknown>) => [
    { color: "var(--chart-1)", label: t("dashboard.charts.revenue"), value: fmt(point.revenue as number) },
    { color: "#f43f5e", label: t("dashboard.charts.expenses"), value: fmt(point.expenses as number) },
    { color: "#10b981", label: t("dashboard.charts.netProfit"), value: fmt(point.profit as number) },
  ];

  return (
    <AreaChart data={series} xDataKey="date" aspectRatio="2 / 1">
      <Grid horizontal />
      <Area dataKey="revenue" fill="var(--chart-1)" stroke="var(--chart-1)" strokeWidth={2.5} fillOpacity={0.14} />
      <Area dataKey="expenses" fill="var(--chart-3)" stroke="#f43f5e" strokeWidth={2} fillOpacity={0.1} />
      <Area dataKey="profit" fill="transparent" stroke="#10b981" strokeWidth={2} fillOpacity={0} showHighlight={false} />
      <XAxis />
      <ChartTooltip rows={rows} />
    </AreaChart>
  );
}