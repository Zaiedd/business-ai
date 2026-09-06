"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, BellRing, CheckCircle2, Lightbulb, PackageSearch, Printer, RefreshCw, Sparkles, TrendingDown, TrendingUp, UsersRound } from "lucide-react";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";
import type { TodayAlert, TodayBundle, TodayRecommendation } from "@/server/today";

const AREA_KEYS = ["sales", "profit", "inventory", "customers", "operations"] as const;

function signedPct(v: number | null): string {
  if (v === null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function fmt(kpi: TodayBundle["kpis"][number], v: number, currency: string, locale: string): string {
  if (kpi.format === "currency") return formatCurrency(v, currency, true, locale);
  if (kpi.format === "currency2") return formatCurrency(v, currency, false, locale);
  return formatNumber(v, 0, locale);
}

function deltaBadge(v: number | null, upside: "up" | "down") {
  if (v === null) return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
  const good = upside === "up" ? v >= 0 : v < 0;
  const Icon = v >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
      <Icon className="size-3" />
      {signedPct(v)}
    </span>
  );
}

function areaColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 65) return "bg-emerald-400";
  if (score >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

function severityBadge(severity: TodayAlert["severity"]) {
  if (severity === "critical") return <Badge variant="critical">{severity}</Badge>;
  if (severity === "attention") return <Badge variant="warning">attention</Badge>;
  return <Badge variant="info">opportunity</Badge>;
}

function priorityBadge(p: TodayRecommendation["priority"]) {
  if (p === "high") return <Badge variant="critical">high</Badge>;
  if (p === "medium") return <Badge variant="warning">medium</Badge>;
  return <Badge variant="neutral">low</Badge>;
}

export default function TodayPage() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<TodayBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/today", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load");
      setData(body.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const currency = data?.meta.currency ?? "USD";
  const health = data?.health;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="space-y-6">
      {/* Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{data?.meta.greeting ?? t("today.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data ? `${data.meta.displayDate} · ${data.meta.companyName}` : t("dashboard.loading")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            {t("today.printToday")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); load(true); }} loading={refreshing}>
            <RefreshCw className="size-3.5" />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40">
          <CardBody className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300">
              <AlertTriangle className="size-4" /> {error}
            </div>
            <Button variant="danger" size="sm" onClick={() => load()}>{t("common.retry")}</Button>
          </CardBody>
        </Card>
      )}

      {loading && !data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
            <CardSkeleton />
          </div>
          <CardSkeleton />
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {!data.hasSalesData && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
              <CardBody className="flex items-center gap-3 text-sm text-amber-700 dark:text-amber-300">
                <Sparkles className="size-4 shrink-0" />
                {t("today.noData")}
              </CardBody>
            </Card>
          )}

          {/* Health areas */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {health && AREA_KEYS.map((k) => (
              <Card key={k}>
                <CardBody className="space-y-2 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t(`health.areas.${k}`)}</p>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{health[k]}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className={cn("h-full rounded-full transition-all", areaColor(health[k]))} style={{ width: `${health[k]}%` }} />
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Brief + KPIs */}
            <div className="space-y-4 lg:col-span-2">
              <Card>
                <CardHeader title={t("today.sections.brief")} actions={<Badge variant="brand"><Sparkles className="size-3" />{data.meta.locale}</Badge>} />
                <CardBody className="space-y-3">
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{data.brief.summary}</p>
                  {(data.brief.positives.length > 0 || data.brief.negatives.length > 0) && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {data.brief.positives.map((p) => (
                        <div key={p} className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /> {p}
                        </div>
                      ))}
                      {data.brief.negatives.map((p) => (
                        <div key={p} className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {p}
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {data.kpis.map((k) => (
                  <Card key={k.key}>
                    <CardBody className="px-4 py-3.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{t(k.labelKey)}</p>
                      <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{fmt(k, k.today, currency, locale)}</p>
                      <div className="mt-2 flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">{t("today.vs.yesterday")}</span>
                          {deltaBadge(k.plusYesterday, "up")}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">{t("today.vs.weekAgo")}</span>
                          {deltaBadge(k.plusWeekAgo, "up")}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">{t("today.vs.avg7")}</span>
                          {deltaBadge(k.plusAvg7, "up")}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>

              {/* Sales highlights */}
              <Card>
                <CardHeader title={t("today.sections.sales")} actions={<Badge variant="info">{t("today.sections.deltas")}</Badge>} />
                <CardBody className="space-y-4">
                  {data.salesHighlights.topCategory && (
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {t("health.signals.topCategory")}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {data.salesHighlights.topCategory.name}
                        {data.salesHighlights.topCategory.deltaPct !== null && (
                          <span className={data.salesHighlights.topCategory.deltaPct! >= 0 ? "ml-2 text-emerald-600 dark:text-emerald-400" : "ml-2 text-rose-600 dark:text-rose-400"}>
                            {signedPct(data.salesHighlights.topCategory.deltaPct)}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {data.salesHighlights.topProducts.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                        <p className="min-w-0 truncate text-slate-700 dark:text-slate-300">{p.name}</p>
                        <div className="flex shrink-0 items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span>{formatNumber(p.qty, 0, locale)} ×</span>
                          <span>{formatCurrency(p.revenue, currency, true, locale)}</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(p.profit, currency, true, locale)}</span>
                        </div>
                      </div>
                    ))}
                    {data.salesHighlights.topProducts.length === 0 && (
                      <p className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">{t("reports.empty")}</p>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* Side column */}
            <div className="space-y-4">
              {/* Alerts */}
              <Card>
                <CardHeader title={t("today.sections.alerts")} actions={<Badge variant={data.alerts.some((a) => a.severity === "critical") ? "critical" : "neutral"}>{data.alerts.length}</Badge>} />
                <CardBody className="max-h-[420px] space-y-2.5 overflow-y-auto">
                  {data.alerts.length === 0 && <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">{t("dashboard.alertsEmptyTitle")}</p>}
                  {data.alerts.map((a) => (
                    <div key={a.id} className="flex items-start gap-2.5 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                      <div className="mt-0.5">{severityBadge(a.severity)}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{a.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{a.detail}</p>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader title={t("today.sections.recs")} />
                <CardBody className="max-h-[500px] space-y-2.5 overflow-y-auto">
                  {data.recommendations.map((r) => (
                    <div key={r.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        {priorityBadge(r.priority)}
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.title}</p>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {r.reason.map((line) => (
                          <li key={line} className="text-xs text-slate-500 dark:text-slate-400">· {line}</li>
                        ))}
                      </ul>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {r.metric.label}: <span className="font-semibold text-slate-700 dark:text-slate-300">{r.metric.value}</span>
                        </span>
                        <a href={r.cta.href} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                          {r.cta.label} <ArrowRight className="size-3 rtl:rotate-180" />
                        </a>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>

              {/* Customers */}
              <Card>
                <CardHeader title={t("today.sections.customers")} />
                <CardBody className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400"><UsersRound className="size-4" />{t("today.kpis.customers")}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{formatNumber(data.customerHighlights.customersToday, 0, locale)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{t("health.signals.repeatRate")}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{formatPercent(data.customerHighlights.repeatRate, 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{t("today.recs.metricCustomers")}</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">{data.customerHighlights.atRiskCount}</span>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>

          {/* Inventory risks + tomorrow */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title={t("today.sections.inventory")} />
              <CardBody className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={data.inventoryRisks.outCount > 0 ? "critical" : "success"}>{t("today.state.outOfStock")}: {data.inventoryRisks.outCount}</Badge>
                  <Badge variant={data.inventoryRisks.criticalCount > 0 ? "warning" : "neutral"}>{t("today.state.critical")}: {data.inventoryRisks.criticalCount}</Badge>
                  <Badge variant={data.inventoryRisks.lowCount > 0 ? "warning" : "neutral"}>{t("today.state.low")}: {data.inventoryRisks.lowCount}</Badge>
                  <Badge variant={data.inventoryRisks.overstockCount > 0 ? "info" : "neutral"}>{t("today.state.overstock")}: {data.inventoryRisks.overstockCount}</Badge>
                  <Badge variant="neutral">{t("reports.kpis.stockValue")}: {formatCurrency(data.inventoryRisks.stockValue, currency, true, locale)}</Badge>
                </div>
                {data.inventoryRisks.criticalItems.length > 0 && (
                  <div className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
                    {data.inventoryRisks.criticalItems.map((c) => (
                      <div key={c.productId} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <p className="flex min-w-0 items-center gap-2 truncate text-slate-700 dark:text-slate-300">
                          <PackageSearch className="size-4 shrink-0 text-slate-400" />
                          {c.name}
                          <span className="text-xs text-slate-400 dark:text-slate-500">({c.currentStock} {t("today.units")})</span>
                        </p>
                        <span className="shrink-0 text-xs font-semibold text-rose-600 dark:text-rose-400">
                          {c.estimatedDaysRemaining === null ? "—" : `≈ ${c.estimatedDaysRemaining.toFixed(1)} ${t("today.unitsDays")}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={t("today.sections.tomorrow")} />
              <CardBody>
                <ul className="space-y-2">
                  {data.tomorrowRisks.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <BellRing className="mt-0.5 size-4 shrink-0 text-indigo-500" /> {r}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 rounded-lg bg-indigo-50 p-3 dark:bg-indigo-950/50">
                  <p className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    <Lightbulb className="size-4" />
                    {t("health.title")}
                  </p>
                  <a href="/reports/health" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                    {t("health.title")} <ArrowRight className="size-3 rtl:rotate-180" />
                  </a>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </motion.div>
  );
}