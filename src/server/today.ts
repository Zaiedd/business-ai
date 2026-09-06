import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { product as productTable, sale, saleItem, customer as customerTable } from "@/lib/drizzle/schema";
import { addDays, clamp, dayKey, endOfDay, formatShortDate, round2, safeParseFloat, safeParseInt, startOfDay } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import { serverT } from "@/lib/i18n/server";
import { getPeriodTotals, getCustomerStats, getAtRiskCustomers, getExpenseByCategory, getTopProducts } from "@/server/analytics";
import {
  computeHealthAreas,
  getDistinctCustomerCount,
  getInventoryIntelligence,
  getTodayCategoryDeltas,
  type HealthAreas,
  type RestockRecommendation,
} from "@/server/retail";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type KpiKey = "revenue" | "grossProfit" | "orders" | "aov" | "customers" | "itemsSold";

export interface KpiComparison {
  key: KpiKey;
  labelKey: string;
  format: "currency" | "currency2" | "number";
  today: number;
  yesterday: number;
  weekAgo: number;
  avg7: number;
  plusYesterday: number | null;
  plusWeekAgo: number | null;
  plusAvg7: number | null;
}

export interface TodayAlert {
  id: string;
  severity: "critical" | "attention" | "opportunity";
  title: string;
  detail: string;
  metric?: { label: string; value: string };
}

export interface TodayRecommendation {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  reason: string[];
  cta: { label: string; href: string };
  metric: { label: string; value: string };
}

export interface TodayBrief {
  summary: string;
  positives: string[];
  negatives: string[];
  risks: string[];
  opportunities: string[];
}

export interface ProductHighlight {
  id: string;
  name: string;
  category: string | null;
  qty: number;
  revenue: number;
  profit: number;
}

export interface TodayBundle {
  meta: {
    dateKey: string;
    displayDate: string;
    companyName: string;
    currency: string;
    greeting: string;
    locale: Locale;
  };
  kpis: KpiComparison[];
  health: HealthAreas;
  hasSalesData: boolean;
  hasInventory: boolean;
  hasHistory: boolean;
  brief: TodayBrief;
  alerts: TodayAlert[];
  recommendations: TodayRecommendation[];
  inventoryRisks: {
    outCount: number;
    criticalCount: number;
    lowCount: number;
    overstockCount: number;
    stockValue: number;
    criticalItems: RestockRecommendation[];
  };
  salesHighlights: {
    topProducts: ProductHighlight[];
    topCategory: { name: string; deltaPct: number | null } | null;
    categoryDeltas: Array<{ category: string; todayRevenue: number; avgRevenue: number; deltaPct: number | null }>;
  };
  customerHighlights: {
    customersToday: number;
    newLast30: number;
    atRiskCount: number;
    repeatRate: number;
  };
  tomorrowRisks: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure analysis builder (deterministic + testable)
// ─────────────────────────────────────────────────────────────────────────────

export interface DailyAnalysisInput {
  today: PeriodTotalsLike;
  yesterday: PeriodTotalsLike;
  weekAgo: PeriodTotalsLike;
  avg7: PeriodTotalsLike;
  customersToday: number;
  customersYesterday: number;
  customersWeekAgo: number;
  customersAvg7: number;
  health: HealthAreas;
  hasSalesData: boolean;
  hasRecentData: boolean;
}

type PeriodTotalsLike = {
  revenue: number;
  grossProfit: number;
  orders: number;
  avgOrderValue: number;
  itemsSold: number;
};

export interface DailyAnalysisResult {
  kpis: KpiComparison[];
  revenuePctVsAvg: number | null;
  profitPctVsAvg: number | null;
  ordersVsAvg: number | null;
  hasSalesData: boolean;
  hasRecentData: boolean;
  health: HealthAreas;
}

export function pctDelta(cur: number, base: number): number | null {
  if (base === 0) return null;
  return round2(((cur - base) / Math.abs(base)) * 100);
}

export function analyzeDaily(input: DailyAnalysisInput): DailyAnalysisResult {
  const comp = (key: KpiKey, labelKey: string, format: "currency" | "currency2" | "number", today: number, yesterday: number, weekAgo: number, avg7: number): KpiComparison => ({
    key,
    labelKey,
    format,
    today,
    yesterday,
    weekAgo,
    avg7,
    plusYesterday: pctDelta(today, yesterday),
    plusWeekAgo: pctDelta(today, weekAgo),
    plusAvg7: pctDelta(today, avg7),
  });

  const kpis: KpiComparison[] = [
    comp("revenue", "today.kpis.revenue", "currency", input.today.revenue, input.yesterday.revenue, input.weekAgo.revenue, input.avg7.revenue),
    comp("grossProfit", "today.kpis.grossProfit", "currency", input.today.grossProfit, input.yesterday.grossProfit, input.weekAgo.grossProfit, input.avg7.grossProfit),
    comp("orders", "today.kpis.orders", "number", input.today.orders, input.yesterday.orders, input.weekAgo.orders, input.avg7.orders),
    comp("aov", "today.kpis.aov", "currency2", input.today.avgOrderValue, input.yesterday.avgOrderValue, input.weekAgo.avgOrderValue, input.avg7.avgOrderValue),
    comp("customers", "today.kpis.customers", "number", input.customersToday, input.customersYesterday, input.customersWeekAgo, input.customersAvg7),
    comp("itemsSold", "today.kpis.itemsSold", "number", input.today.itemsSold, input.yesterday.itemsSold, input.weekAgo.itemsSold, input.avg7.itemsSold),
  ];

  const avgRevenue = input.avg7.revenue;
  const avgProfit = input.avg7.grossProfit;
  const avgOrders = input.avg7.orders;

  return {
    kpis,
    revenuePctVsAvg: avgRevenue > 0 ? pctDelta(input.today.revenue, avgRevenue) : null,
    profitPctVsAvg: avgProfit > 0 ? pctDelta(input.today.grossProfit, avgProfit) : null,
    ordersVsAvg: avgOrders > 0 ? pctDelta(input.today.orders, avgOrders) : null,
    hasSalesData: input.hasSalesData,
    hasRecentData: input.hasRecentData,
    health: input.health,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bundle builder
// ─────────────────────────────────────────────────────────────────────────────

export async function getTodayBundle(companyId: string, companyName: string, currency: string, locale: Locale = "en"): Promise<TodayBundle | null> {
  const t = serverT(locale);
  const now = new Date();
  const today = startOfDay(now);
  const todayTo = endOfDay(now);
  const yesterday = addDays(today, -1);
  const yFrom = startOfDay(yesterday);
  const yTo = endOfDay(yesterday);
  const weekAgo = addDays(today, -7);
  const wFrom = startOfDay(weekAgo);
  const wTo = endOfDay(addDays(today, -1));
  const avgFrom = startOfDay(addDays(today, -7));

  const lookback = 30;
  const invFrom = startOfDay(addDays(now, -(lookback - 1)));

  const [cur, yesterdayTotals, weekAgoTotals, avgTotals, customersToday, customersYesterday, customersWeekAgo, avgCustomers, inventory, customerStats, atRisk, topToday, catDeltas, expensesToday, expensesAvg, pairs] =
    await Promise.all([
      getPeriodTotals(companyId, today, todayTo),
      getPeriodTotals(companyId, yFrom, yTo),
      getPeriodTotals(companyId, wFrom, wTo),
      getPeriodTotals(companyId, avgFrom, wTo),
      getDistinctCustomerCount(companyId, today, todayTo),
      getDistinctCustomerCount(companyId, yFrom, yTo),
      getDistinctCustomerCount(companyId, wFrom, wTo),
      getDistinctCustomerCount(companyId, avgFrom, wTo),
      getInventoryIntelligence(companyId, lookback),
      getCustomerStats(companyId, avgFrom, wTo),
      getAtRiskCustomers(companyId, 45, 8),
      getTopProducts(companyId, today, todayTo, 5),
      getTodayCategoryDeltas(companyId, today, avgFrom, wTo),
      getExpenseByCategory(companyId, today, todayTo),
      getExpenseByCategory(companyId, avgFrom, wTo),
      getCrossSellPairs(companyId, avgFrom, wTo, 10),
    ]);

  const avgCustomersValue = round2(avgCustomers / 7);
  const hasSalesData = cur.revenue > 0 || cur.orders > 0;
  const recentRevenue = avgTotals.revenue;
  const hasRecentData = recentRevenue > 0;
  const hasInventory = inventory.totalSkus > 0;

  // Refund rate over the last 30 days (approximate from completed vs refunded volume).
  const [refundedRow, completedRow] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)::int` }).from(sale).where(and(eq(sale.companyId, companyId), eq(sale.status, "REFUNDED"), gte(sale.date, invFrom), lte(sale.date, todayTo))),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(sale).where(and(eq(sale.companyId, companyId), eq(sale.status, "COMPLETED"), gte(sale.date, invFrom), lte(sale.date, todayTo))),
  ]);
  const refundRate = Number(completedRow[0]?.count ?? 0) > 0 ? Number(refundedRow[0]?.count ?? 0) / Number(completedRow[0]?.count ?? 0) : 0;

  const todayExpenses = expensesToday.reduce((a, e) => a + e.amount, 0);
  const daysInLookback = Math.max(1, Math.round((wTo.getTime() - avgFrom.getTime()) / 86_400_000) + 1);
  const avgDailyExpenses = expensesAvg.reduce((a, e) => a + e.amount, 0) / daysInLookback;

  const healthyShare = inventory.totalSkus > 0 ? 1 - (inventory.lowCount + inventory.outCount) / inventory.totalSkus : 1;
  const coverageValues = inventory.low
    .concat(inventory.out)
    .map((p) => p.daysRemaining)
    .filter((d): d is number => d !== null);
  const avgCoverage = coverageValues.length > 0 ? coverageValues.reduce((a, d) => a + d, 0) / coverageValues.length : null;

  const analysis = analyzeDaily({
    today: cur,
    yesterday: yesterdayTotals,
    weekAgo: weekAgoTotals,
    avg7: avgTotals,
    customersToday,
    customersYesterday,
    customersWeekAgo,
    customersAvg7: avgCustomersValue,
    health: computeHealthAreas({
      revenueGrowth: avgTotals.revenue > 0 ? (cur.revenue - avgTotals.revenue) / avgTotals.revenue : 0,
      orderGrowth: avgTotals.orders > 0 ? (cur.orders - avgTotals.orders) / avgTotals.orders : 0,
      aovGrowth: avgTotals.avgOrderValue > 0 ? (cur.avgOrderValue - avgTotals.avgOrderValue) / avgTotals.avgOrderValue : 0,
      margin: cur.revenue > 0 ? cur.grossProfit / cur.revenue : avgTotals.revenue > 0 ? avgTotals.grossProfit / avgTotals.revenue : 0,
      profitGrowth: Math.abs(avgTotals.grossProfit) > 0 ? (cur.grossProfit - avgTotals.grossProfit) / Math.abs(avgTotals.grossProfit) : 0,
      healthyStockShare: healthyShare,
      avgCoverageDays: avgCoverage,
      overstockShare: inventory.totalSkus > 0 ? inventory.overstockCount / inventory.totalSkus : 0,
      repeatRate: customerStats.repeatRate,
      activeCustomerShare: customerStats.totalCustomers > 0 ? customerStats.activeCustomers / customerStats.totalCustomers : 0,
      atRiskShare: atRisk.length > 0 ? atRisk.length / Math.max(1, customerStats.totalCustomers) : 0,
      refundRate,
      cashFlowRatio: cur.revenue > 0 ? (cur.revenue - todayExpenses) / cur.revenue : 0,
      expenseGrowth: avgDailyExpenses > 0 ? (todayExpenses - avgDailyExpenses) / avgDailyExpenses : 0,
      hasEnoughData: hasRecentData || hasSalesData,
    }),
    hasSalesData,
    hasRecentData,
  });

  const hour = now.getHours();
  const greetingKey = hour < 12 ? "today.greeting.morning" : hour < 18 ? "today.greeting.afternoon" : "today.greeting.evening";

  const brief = buildBrief(analysis, inventory, atRisk.length, catDeltas, pairs, t);
  const alerts = buildAlerts(analysis, inventory, catDeltas, pairs, atRisk.length, todayExpenses, cur, t);
  const recommendations = buildRecommendations(analysis, inventory, catDeltas, pairs, atRisk.length, t);
  const tomorrowRisks = buildTomorrowRisks(analysis, inventory, t);

  const newLast30 = await countNewCustomers(companyId, addDays(now, -30));

  const topCategory = catDeltas[0] ? { name: catDeltas[0].category, deltaPct: catDeltas[0].deltaPct } : null;

  return {
    meta: {
      dateKey: dayKey(today),
      displayDate: formatShortDate(today, locale),
      companyName,
      currency,
      greeting: t(greetingKey, { company: companyName }),
      locale,
    },
    kpis: analysis.kpis,
    health: analysis.health,
    hasSalesData,
    hasInventory,
    hasHistory: false,
    brief,
    alerts,
    recommendations,
    inventoryRisks: {
      outCount: inventory.outCount,
      criticalCount: inventory.criticalCount,
      lowCount: inventory.lowCount,
      overstockCount: inventory.overstockCount,
      stockValue: inventory.stockValue,
      criticalItems: inventory.restockRecommendations.slice(0, 5),
    },
    salesHighlights: {
      topProducts: topToday.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        qty: p.qty,
        revenue: p.revenue,
        profit: p.profit,
      })),
      topCategory,
      categoryDeltas: catDeltas,
    },
    customerHighlights: {
      customersToday,
      newLast30,
      atRiskCount: atRisk.length,
      repeatRate: customerStats.repeatRate,
    },
    tomorrowRisks,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Narrative builders
// ─────────────────────────────────────────────────────────────────────────────

type T = (path: string, params?: Record<string, string | number>) => string;

function buildBrief(
  a: DailyAnalysisResult,
  inv: Awaited<ReturnType<typeof getInventoryIntelligence>>,
  atRiskCount: number,
  catDeltas: Array<{ category: string; todayRevenue: number; avgRevenue: number; deltaPct: number | null }>,
  pairs: CrossSellPair[],
  t: T,
): TodayBrief {
  const positives: string[] = [];
  const negatives: string[] = [];
  const risks: string[] = [];
  const opportunities: string[] = [];

  if (a.revenuePctVsAvg !== null && a.revenuePctVsAvg >= 5) {
    positives.push(t("today.brief.revenueUp", { pct: String(a.revenuePctVsAvg) }));
  } else if (a.revenuePctVsAvg !== null && a.revenuePctVsAvg <= -5) {
    negatives.push(t("today.brief.revenueDown", { pct: String(Math.abs(a.revenuePctVsAvg)) }));
  }

  if (a.profitPctVsAvg !== null && a.profitPctVsAvg >= 5) {
    positives.push(t("today.brief.profitUp", { pct: String(a.profitPctVsAvg) }));
  } else if (a.profitPctVsAvg !== null && a.profitPctVsAvg <= -5) {
    negatives.push(t("today.brief.profitDown", { pct: String(Math.abs(a.profitPctVsAvg)) }));
  }

  const growing = catDeltas.filter((c) => c.deltaPct !== null && c.deltaPct >= 15 && c.todayRevenue > 0);
  const declining = catDeltas.filter((c) => c.deltaPct !== null && c.deltaPct <= -15 && c.todayRevenue > 0);
  if (growing.length > 0) {
    positives.push(t("today.brief.categoryUp", { names: growing.slice(0, 2).map((c) => c.category).join(", "), pct: String(growing[0].deltaPct) }));
  }
  if (declining.length > 0) {
    negatives.push(t("today.brief.categoryDown", { names: declining.slice(0, 2).map((c) => c.category).join(", "), pct: String(Math.abs(declining[0].deltaPct ?? 0)) }));
  }

  if (inv.criticalCount > 0) {
    risks.push(t("today.brief.criticalStock", { count: String(inv.criticalCount) }));
  }
  if (inv.outCount > 0) {
    risks.push(t("today.brief.outOfStock", { count: String(inv.outCount) }));
  }
  if (atRiskCount > 0) {
    risks.push(t("today.brief.atRisk", { count: String(atRiskCount) }));
  }
  if (inv.overstockCount > 0) {
    risks.push(t("today.brief.overstock", { count: String(inv.overstockCount) }));
  }

  if (pairs.length > 0 && pairs[0].count >= 2) {
    opportunities.push(t("today.brief.crossSell", { a: pairs[0].a, b: pairs[0].b, count: String(pairs[0].count) }));
  }
  if (inv.restockRecommendations.length > 0) {
    opportunities.push(t("today.brief.restockNow", { count: String(inv.restockRecommendations.length) }));
  }

  const summary = !a.hasSalesData
    ? t("today.brief.empty")
    : !a.hasRecentData
      ? t("today.brief.noHistory")
      : t("today.brief.summary", {
          rev: String(a.revenuePctVsAvg ?? 0),
          profit: String(a.profitPctVsAvg ?? 0),
        });

  return { summary, positives, negatives, risks, opportunities };
}

function buildAlerts(
  a: DailyAnalysisResult,
  inv: Awaited<ReturnType<typeof getInventoryIntelligence>>,
  catDeltas: Array<{ category: string; todayRevenue: number; avgRevenue: number; deltaPct: number | null }>,
  pairs: CrossSellPair[],
  atRiskCount: number,
  todayExpenses: number,
  cur: { revenue: number; netProfit: number; cashFlow: number },
  t: T,
): TodayAlert[] {
  const alerts: TodayAlert[] = [];

  // Critical: stockout risk
  const urgent = inv.critical.filter((p) => p.stockQty <= 0 || (p.daysRemaining !== null && p.daysRemaining <= 2)).slice(0, 3);
  for (const p of urgent) {
    alerts.push({
      id: `stockout-${p.id}`,
      severity: "critical",
      title: p.stockQty <= 0 ? t("today.alerts.outOfStockTitle", { name: p.name }) : t("today.alerts.stockoutTitle", { name: p.name, days: String(Math.max(1, Math.ceil(p.daysRemaining ?? 0))) }),
      detail: t("today.alerts.stockoutDetail", { stock: String(p.stockQty), velocity: p.avgDailySales.toFixed(1) }),
      metric: { label: p.name, value: `${p.stockQty} ${t("today.units")}` },
    });
  }

  // Critical: negative cash today
  if (cur.cashFlow < 0 && todayExpenses > 0) {
    alerts.push({
      id: "cash-negative",
      severity: "critical",
      title: t("today.alerts.cashTitle"),
      detail: t("today.alerts.cashDetail", { amount: String(Math.abs(round2(cur.cashFlow))) }),
      metric: { label: t("today.kpis.revenue"), value: String(round2(cur.revenue)) },
    });
  }

  // Attention: revenue / profit below average
  if (a.revenuePctVsAvg !== null && a.revenuePctVsAvg <= -15) {
    alerts.push({
      id: "revenue-low",
      severity: "attention",
      title: t("today.alerts.revenueLowTitle"),
      detail: t("today.alerts.revenueLowDetail", { pct: String(Math.abs(a.revenuePctVsAvg)) }),
    });
  }
  if (a.profitPctVsAvg !== null && a.profitPctVsAvg <= -20) {
    alerts.push({
      id: "profit-low",
      severity: "attention",
      title: t("today.alerts.profitLowTitle"),
      detail: t("today.alerts.profitLowDetail", { pct: String(Math.abs(a.profitPctVsAvg)) }),
    });
  }

  // Attention: declining categories
  const declining = catDeltas.filter((c) => c.deltaPct !== null && c.deltaPct <= -18 && c.todayRevenue > 0);
  for (const c of declining.slice(0, 2)) {
    alerts.push({
      id: `cat-down-${c.category}`,
      severity: "attention",
      title: t("today.alerts.categoryDownTitle", { category: c.category }),
      detail: t("today.alerts.categoryDownDetail", { pct: String(Math.abs(c.deltaPct ?? 0)) }),
    });
  }

  // Attention: at-risk customers
  if (atRiskCount >= 2) {
    alerts.push({
      id: "customers-at-risk",
      severity: "attention",
      title: t("today.alerts.atRiskTitle", { count: String(atRiskCount) }),
      detail: t("today.alerts.atRiskDetail"),
      metric: { label: t("today.kpis.customers"), value: String(atRiskCount) },
    });
  }

  // Attention: overstock
  if (inv.overstockCount > 0 && inv.overstock[0]) {
    const o = inv.overstock[0];
    alerts.push({
      id: "overstock",
      severity: "attention",
      title: t("today.alerts.overstockTitle", { name: o.name }),
      detail: t("today.alerts.overstockDetail", { stock: String(o.stockQty) }),
    });
  }

  // Opportunity: revenue up
  if (a.revenuePctVsAvg !== null && a.revenuePctVsAvg >= 15) {
    alerts.push({ id: "revenue-up", severity: "opportunity", title: t("today.alerts.revenueUpTitle", { pct: String(a.revenuePctVsAvg) }), detail: t("today.alerts.revenueUpDetail") });
  }

  // Opportunity: growing categories
  const growing = catDeltas.filter((c) => c.deltaPct !== null && c.deltaPct >= 18 && c.todayRevenue > 0);
  for (const c of growing.slice(0, 2)) {
    alerts.push({
      id: `cat-up-${c.category}`,
      severity: "opportunity",
      title: t("today.alerts.categoryUpTitle", { category: c.category }),
      detail: t("today.alerts.categoryUpDetail", { pct: String(c.deltaPct ?? 0) }),
    });
  }

  // Opportunity: cross-sell
  if (pairs.length > 0 && pairs[0].count >= 3) {
    alerts.push({
      id: "cross-sell",
      severity: "opportunity",
      title: t("today.alerts.crossSellTitle", { a: pairs[0].a, b: pairs[0].b }),
      detail: t("today.alerts.crossSellDetail", { count: String(pairs[0].count) }),
    });
  }

  return alerts;
}

function buildRecommendations(
  a: DailyAnalysisResult,
  inv: Awaited<ReturnType<typeof getInventoryIntelligence>>,
  catDeltas: Array<{ category: string; todayRevenue: number; avgRevenue: number; deltaPct: number | null }>,
  pairs: CrossSellPair[],
  atRiskCount: number,
  t: T,
): TodayRecommendation[] {
  const recs: TodayRecommendation[] = [];

  const urgent = inv.restockRecommendations.slice(0, 4);
  for (const r of urgent) {
    recs.push({
      id: `restock-${r.productId}`,
      priority: r.estimatedDaysRemaining !== null && r.estimatedDaysRemaining <= 3 ? "high" : "medium",
      title: t("today.recs.restockTitle", { name: r.name }),
      reason: [
        t("today.recs.reasonStock", { stock: String(r.currentStock) }),
        t("today.recs.reasonVelocity", { velocity: r.avgDailySales.toFixed(1) }),
        ...(r.estimatedDaysRemaining !== null ? [t("today.recs.reasonDays", { days: r.estimatedDaysRemaining.toFixed(1) })] : []),
        ...(r.recentTrend !== null ? [t("today.recs.reasonTrend", { pct: String(r.recentTrend > 0 ? `+${r.recentTrend}` : r.recentTrend) })] : []),
      ],
      cta: { label: t("today.recs.ctaInventory"), href: "/inventory" },
      metric: { label: t("today.recs.metricStock"), value: String(r.currentStock) },
    });
  }

  const declining = catDeltas.filter((c) => c.deltaPct !== null && c.deltaPct <= -15 && c.todayRevenue > 0);
  if (declining.length > 0) {
    recs.push({
      id: "investigate-category",
      priority: "medium",
      title: t("today.recs.investigateTitle", { category: declining[0].category }),
      reason: [t("today.recs.investigateReason", { pct: String(Math.abs(declining[0].deltaPct ?? 0)) })],
      cta: { label: t("today.recs.ctaAnalyze"), href: "/reports/health" },
      metric: { label: t("today.recs.metricDelta"), value: `${(declining[0].deltaPct ?? 0).toFixed(0)}%` },
    });
  }

  if (atRiskCount >= 2) {
    recs.push({
      id: "reactivate-customers",
      priority: "medium",
      title: t("today.recs.reactivateTitle", { count: String(atRiskCount) }),
      reason: [t("today.recs.reactivateReason")],
      cta: { label: t("today.recs.ctaCustomers"), href: "/customers" },
      metric: { label: t("today.recs.metricCustomers"), value: String(atRiskCount) },
    });
  }

  if (pairs.length > 0 && pairs[0].count >= 3) {
    recs.push({
      id: "cross-sell",
      priority: "medium",
      title: t("today.recs.crossSellTitle", { a: pairs[0].a, b: pairs[0].b }),
      reason: [t("today.recs.crossSellReason", { count: String(pairs[0].count) })],
      cta: { label: t("today.recs.ctaCustomers"), href: "/customers" },
      metric: { label: t("today.recs.metricPairs"), value: String(pairs[0].count) },
    });
  }

  const growing = catDeltas.filter((c) => c.deltaPct !== null && c.deltaPct >= 15 && c.todayRevenue > 0);
  if (growing.length > 0) {
    recs.push({
      id: "capture-growth",
      priority: "low",
      title: t("today.recs.captureTitle", { category: growing[0].category }),
      reason: [t("today.recs.captureReason", { pct: String(growing[0].deltaPct ?? 0) })],
      cta: { label: t("today.recs.ctaInventory"), href: "/inventory" },
      metric: { label: t("today.recs.metricDelta"), value: `${(growing[0].deltaPct ?? 0).toFixed(0)}%` },
    });
  }

  if (inv.overstockCount > 0) {
    recs.push({
      id: "clear-overstock",
      priority: "low",
      title: t("today.recs.overstockTitle", { count: String(inv.overstockCount) }),
      reason: [t("today.recs.overstockReason")],
      cta: { label: t("today.recs.ctaInventory"), href: "/inventory" },
      metric: { label: t("today.recs.metricCount"), value: String(inv.overstockCount) },
    });
  }

  return recs;
}

function buildTomorrowRisks(a: DailyAnalysisResult, inv: Awaited<ReturnType<typeof getInventoryIntelligence>>, t: T): string[] {
  const risks: string[] = [];
  const soon = inv.critical.filter((p) => p.stockQty > 0 && p.daysRemaining !== null && p.daysRemaining <= 2).slice(0, 3);
  if (soon.length > 0) {
    risks.push(t("today.tomorrow.stockout", { names: soon.map((p) => p.name).join(", ") }));
  }
  if (a.revenuePctVsAvg !== null && a.revenuePctVsAvg >= 30) {
    risks.push(t("today.tomorrow.highDemand"));
  }
  if (inv.overstockCount > 2) {
    risks.push(t("today.tomorrow.overstockCash", { count: String(inv.overstockCount) }));
  }
  if (risks.length === 0) {
    risks.push(t("today.tomorrow.none"));
  }
  return risks;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface CrossSellPair {
  a: string;
  b: string;
  count: number;
}

export async function getCrossSellPairs(companyId: string, from: Date, to: Date, limit = 10): Promise<CrossSellPair[]> {
  const [products, rows] = await Promise.all([
    db.select({ id: productTable.id, name: productTable.name }).from(productTable).where(eq(productTable.companyId, companyId)),
    db
      .select({ saleId: sale.id, productId: saleItem.productId })
      .from(saleItem)
      .innerJoin(sale, eq(sale.id, saleItem.saleId))
      .where(and(eq(sale.companyId, companyId), eq(sale.status, "COMPLETED"), gte(sale.date, from), lte(sale.date, to))),
  ]);
  const nameById = new Map(products.map((p) => [p.id, p.name]));
  const bySale = new Map<string, string[]>();
  for (const r of rows) {
    const set = bySale.get(String(r.saleId));
    if (set) {
      if (!set.includes(String(r.productId))) set.push(String(r.productId));
    } else {
      bySale.set(String(r.saleId), [String(r.productId)]);
    }
  }
  const counts = new Map<string, number>();
  for (const productsIds of bySale.values()) {
    if (productsIds.length < 2) continue;
    for (let i = 0; i < productsIds.length; i++) {
      for (let j = i + 1; j < productsIds.length; j++) {
        const [a, b] = productsIds[i] < productsIds[j] ? [productsIds[i], productsIds[j]] : [productsIds[j], productsIds[i]];
        const key = `${a}|${b}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .map(([key, count]) => {
      const [a, b] = key.split("|");
      return { a: nameById.get(a) ?? a, b: nameById.get(b) ?? b, count };
    })
    .sort((x, y) => y.count - x.count)
    .filter((p) => p.a !== p.b)
    .slice(0, limit);
}

export async function countNewCustomers(companyId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(customerTable)
    .where(and(eq(customerTable.companyId, companyId), gte(customerTable.createdAt, since)));
  return Number(row?.count ?? 0);
}

export { clamp };