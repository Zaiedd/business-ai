"use client";

import BarChart from "@/components/charts/bar-chart";
import Bar from "@/components/charts/bar";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { Grid } from "@/components/charts/grid";
import { useI18n } from "@/components/i18n-provider";
import { stripBidi } from "@/lib/utils";

export function ProductProfitChart({ data, currency }: { data: Array<{ name: string; profit: number; revenue: number }>; currency: string }) {
  const { t, locale } = useI18n();
  const sorted = [...data].sort((a, b) => b.profit - a.profit).slice(0, 6);

  const fmt = (v: number) =>
    stripBidi(
      new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(v)
    );

  return (
    <BarChart data={sorted} orientation="horizontal" xDataKey="name" aspectRatio="1.5 / 1" barGap={0.45}>
      <Grid vertical />
      <Bar dataKey="profit" fill="var(--chart-1)" lineCap="round" />
      <BarYAxis showAllLabels />
      <ChartTooltip
        rows={(point) => [
          { color: "var(--chart-1)", label: t("dashboard.charts.profit"), value: fmt(point.profit as number) },
        ]}
      />
    </BarChart>
  );
}