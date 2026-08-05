"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CircleDollarSign, Coins, PiggyBank, Receipt, RefreshCw, ShoppingBag, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent, formatShortDate } from "@/lib/utils";
import type { DateRange } from "@/lib/validators";
import type { DashboardBundle } from "@/server/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { HealthGauge } from "@/components/dashboard/health-gauge";
import { RevenueTrendChart } from "@/components/dashboard/revenue-chart";
import { ProductProfitChart } from "@/components/dashboard/product-profit-chart";
import { ExpensePieChart } from "@/components/dashboard/expense-pie-chart";
import { ForecastCard } from "@/components/dashboard/forecast-card";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { RecentSalesTable } from "@/components/dashboard/recent-sales";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";

const RANGES: DateRange[] = ["7d", "30d", "90d", "12m"];

const pct = (cur: number, prev: number) => (prev !== 0 ? (cur - prev) / Math.abs(prev) : cur !== 0 ? 1 : 0);

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const [range, setRange] = useState<DateRange>("30d");
  const [data, setData] = useState<DashboardBundle | null>(null);
  const [role, setRole] = useState<string>("EMPLOYEE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (r: DateRange, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/overview?range=${r}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("dashboard.overviewFailed"));
      const { role: rl, ...bundle } = body.data;
      setData(bundle);
      setRole(rl);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard.overviewFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    load(range);
  }, [load, range]);

  const cur = data?.overview.current;
  const prev = data?.overview.previous;
  const currency = data?.meta.currency ?? "USD";

  const kpis = useMemo(() => {
    if (!cur || !prev) return [];
    return [
      { label: t("dashboard.kpis.revenue"), value: formatCurrency(cur.revenue, currency, true), delta: data!.overview.deltas.revenue, positiveIsGood: true, icon: CircleDollarSign, accent: "indigo" as const },
      { label: t("dashboard.kpis.grossProfit"), value: formatCurrency(cur.grossProfit, currency, true), delta: pct(cur.grossProfit, prev.grossProfit), positiveIsGood: true, icon: PiggyBank, accent: "violet" as const },
      { label: t("dashboard.kpis.netProfit"), value: formatCurrency(cur.netProfit, currency, true), delta: data!.overview.deltas.netProfit, positiveIsGood: true, icon: TrendingUp, accent: "emerald" as const },
      { label: t("dashboard.kpis.cashFlow"), value: formatCurrency(cur.cashFlow, currency, true), delta: pct(cur.cashFlow, prev.cashFlow), positiveIsGood: true, icon: Coins, accent: "amber" as const },
      { label: t("dashboard.kpis.orders"), value: formatNumber(cur.orders), delta: data!.overview.deltas.orders, positiveIsGood: true, icon: Receipt, accent: "rose" as const },
      { label: t("dashboard.kpis.avgOrderValue"), value: formatCurrency(cur.avgOrderValue, currency), delta: pct(cur.avgOrderValue, prev.avgOrderValue), positiveIsGood: true, icon: ShoppingBag, accent: "indigo" as const },
    ];
  }, [cur, prev, currency, data, t]);

  const localizedSeries = useMemo(() => {
    if (!data) return [];
    return data.series.map((p) => ({ ...p, label: formatShortDate(p.date, locale) }));
  }, [data, locale]);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t("nav.dashboard")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data ? t("dashboard.updated", { time: new Date(data.meta.asOf).toLocaleTimeString(locale) }) : t("dashboard.loading")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  range === r ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
                )}
              >
                {t(`dashboard.ranges.${r}`)}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); load(range, true); }} loading={refreshing}>
            <RefreshCw className="size-3.5" />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40">
          <CardBody className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300">
              <AlertCircle className="size-4" />
              {error}
            </div>
            <Button variant="danger" size="sm" onClick={() => load(range)}>
              {t("common.retry")}
            </Button>
          </CardBody>
        </Card>
      )}

      {loading && !data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      )}

      {data && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {kpis.map((k) => (
              <KpiCard key={k.label} {...k} footer={k.label === t("dashboard.kpis.netProfit") ? t("dashboard.kpis.marginFooter", { value: formatPercent(cur!.margin) }) : undefined} />
            ))}
          </div>

          {/* Trend + Health + Forecast */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title={t("dashboard.charts.trendTitle")}
                subtitle={t("dashboard.charts.trendSubtitle", { range: t(`dashboard.lastRange.${range}`) })}
              />
              <CardBody>
                <RevenueTrendChart data={localizedSeries} currency={currency} />
              </CardBody>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Card>
                <CardHeader title={t("dashboard.charts.healthTitle")} subtitle={t("dashboard.charts.healthSubtitle")} />
                <CardBody>
                  <HealthGauge score={data.overview.score} label={data.overview.label} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title={t("dashboard.charts.forecastTitle")} subtitle={t("dashboard.charts.forecastSubtitle")} />
                <CardBody>
                  <ForecastCard forecast={data.forecast} currency={currency} recentPoints={localizedSeries.slice(-14).map((p) => ({ label: p.label, revenue: p.revenue }))} />
                </CardBody>
              </Card>
            </div>
          </div>

          {/* Products / Expenses / Alerts */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title={t("dashboard.charts.productsTitle")} subtitle={t("dashboard.charts.productsSubtitle")} />
              <CardBody>
                <ProductProfitChart data={data.topProducts} currency={currency} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={t("dashboard.charts.expensesTitle")} subtitle={t("dashboard.charts.expensesSubtitle", { total: formatCurrency(cur!.expenses, currency) })} />
              <CardBody>
                <ExpensePieChart data={data.expenseByCategory} currency={currency} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title={t("dashboard.charts.alertsTitle")}
                subtitle={t("dashboard.charts.alertsSubtitle")}
                actions={<Badge variant={data.alerts.length > 0 ? "critical" : "success"}>{data.alerts.length}</Badge>}
              />
              <CardBody className="max-h-[420px] overflow-y-auto">
                <AlertsPanel alerts={data.alerts} />
              </CardBody>
            </Card>
          </div>

          {/* Insights + Recent sales + Quick actions */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardBody className="px-5 py-5">
                <InsightsPanel insights={data.insights} />
              </CardBody>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader title={t("dashboard.quickTitle")} subtitle={t("dashboard.quickSubtitle")} />
                <CardBody>
                  <QuickActions range={range} isAdmin={role === "OWNER" || role === "ADMIN"} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title={t("dashboard.atRiskTitle")} subtitle={t("dashboard.atRiskSubtitle")} actions={data.atRiskCustomers.length > 0 ? <Badge variant="warning">{data.atRiskCustomers.length}</Badge> : undefined} />
                <CardBody className="space-y-2.5">
                  {data.atRiskCustomers.length === 0 && <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">{t("dashboard.atRiskEmpty")}</p>}
                  {data.atRiskCustomers.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900 dark:text-slate-100">{c.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t("dashboard.atRiskMeta", { orders: String(c.totalOrders), spent: formatCurrency(c.totalSpent, currency) })}</p>
                      </div>
                      <Badge variant="warning">{c.daysInactive}d</Badge>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader title={t("dashboard.recentTitle")} subtitle={t("dashboard.recentSubtitle")} />
            <CardBody>
              <RecentSalesTable sales={data.recentSales} currency={currency} />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
