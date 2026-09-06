import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sale } from "@/lib/drizzle/schema";
import type { Locale } from "@/lib/i18n";
import { serverT } from "@/lib/i18n/server";
import { addDays, clamp, endOfDay, formatCurrency, formatDate, formatNumber, formatPercent, round2, startOfDay } from "@/lib/utils";
import { getAtRiskCustomers, getCustomerStats, getExpenseByCategory, getPeriodTotals, getTopBranches, getTopProducts } from "@/server/analytics";
import type { AtRiskCustomer, PeriodTotals } from "@/server/analytics";
import { computeHealthAreas, getInventoryIntelligence, getProfitIntelligence } from "@/server/retail";
import type { HealthAreaInput, HealthAreas, InventoryIntelligence, ProfitIntelligence } from "@/server/retail";

// ─────────────────────────────────────────────────────────────────────────────
// Period model (health reports support 7d / 30d / 90d / 6m / 12m / custom)
// ─────────────────────────────────────────────────────────────────────────────

export const HEALTH_PERIODS = ["7d", "30d", "90d", "6m", "12m", "custom"] as const;
export type HealthPeriod = (typeof HEALTH_PERIODS)[number];

const PERIOD_DAYS: Record<Exclude<HealthPeriod, "custom">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "6m": 180,
  "12m": 365,
};

export function healthPeriodDays(period: HealthPeriod, customDays?: number): number {
  if (period === "custom") return clamp(Number(customDays) || 30, 7, 365);
  return PERIOD_DAYS[period];
}

export function healthPeriodBounds(period: HealthPeriod, customDays?: number): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const days = healthPeriodDays(period, customDays);
  const to = endOfDay(new Date());
  const from = startOfDay(addDays(new Date(), -(days - 1)));
  const prevTo = endOfDay(addDays(from, -1));
  const prevFrom = startOfDay(addDays(prevTo, -(days - 1)));
  return { from, to, prevFrom, prevTo };
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type HealthSignalStatus = "good" | "neutral" | "bad";

export interface HealthSignal {
  key: string;
  label: string;
  value: string;
  status: HealthSignalStatus;
  goodWhenUp: boolean;
}

export type HealthAreaKey = keyof Omit<HealthAreas, "overall" | "status">;

export interface HealthAreaReport {
  key: HealthAreaKey;
  score: number;
  label: string;
  summary: string;
  signals: HealthSignal[];
  findings: string[];
}

export interface HealthKpi {
  key: string;
  label: string;
  current: string;
  previous: string;
  deltaPct: number | null;
  goodWhenUp: boolean;
}

export interface HealthRisk {
  title: string;
  severity: "high" | "medium" | "low";
  description: string;
}

export interface HealthOpportunity {
  title: string;
  impact: string;
  description: string;
}

export interface HealthAction {
  priority: "high" | "medium" | "low";
  action: string;
  area: string;
  impact: string;
}

export interface HealthReportBundle {
  meta: {
    companyName: string;
    currency: string;
    locale: Locale;
    period: HealthPeriod;
    customDays: number | null;
    days: number;
    from: string;
    to: string;
    generatedAt: string;
  };
  headline: {
    score: number | null;
    status: HealthAreas["status"];
    statusLabel: string;
    summary: string;
    prevScore: number | null;
    change: number | null;
  };
  areas: HealthAreaReport[];
  kpis: HealthKpi[];
  diagnosis: string[];
  risks: HealthRisk[];
  opportunities: HealthOpportunity[];
  actionPlan: HealthAction[];
  topProducts: Awaited<ReturnType<typeof getTopProducts>>;
  topBranches: Awaited<ReturnType<typeof getTopBranches>>;
  profit: ProfitIntelligence;
  inventory: {
    totalSkus: number;
    totalUnits: number;
    stockValue: number;
    lowCount: number;
    criticalCount: number;
    outCount: number;
    overstockCount: number;
    criticalItems: InventoryIntelligence["critical"];
  };
  atRiskCustomers: AtRiskCustomer[];
}

type T = (path: string, params?: Record<string, string | number>) => string;

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (deterministic, testable)
// ─────────────────────────────────────────────────────────────────────────────

function sigStatus(value: number | null, goodWhenUp: boolean, good: number, bad: number): HealthSignalStatus {
  if (value === null) return "neutral";
  if (goodWhenUp) return value >= good ? "good" : value <= bad ? "bad" : "neutral";
  return value <= good ? "good" : value >= bad ? "bad" : "neutral";
}

function nicePct(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${Math.abs(value * 100).toFixed(digits)}%`;
}

function avgCoverageDays(inv: InventoryIntelligence): number | null {
  const values = inv.low.concat(inv.out).map((p) => p.daysRemaining).filter((d): d is number => d !== null);
  if (values.length === 0) return null;
  return round2(values.reduce((a, d) => a + d, 0) / values.length);
}

function adviceTier(score: number, strong: string, ok: string, weak: string): string {
  return score >= 80 ? strong : score >= 65 ? ok : weak;
}

/** Refunded vs completed orders for a range (drives the operations refund signal). */
export async function getOrderCounts(companyId: string, from: Date, to: Date): Promise<{ completed: number; refunded: number }> {
  const rows = await db
    .select({ status: sale.status, count: sql<number>`COUNT(*)::int` })
    .from(sale)
    .where(and(eq(sale.companyId, companyId), gte(sale.date, from), lte(sale.date, to)))
    .groupBy(sale.status);
  const map = new Map(rows.map((r) => [String(r.status), Number(r.count ?? 0)]));
  return { completed: map.get("COMPLETED") ?? 0, refunded: map.get("REFUNDED") ?? 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bundle builder
// ─────────────────────────────────────────────────────────────────────────────

export async function getHealthReport(
  companyId: string,
  companyName: string,
  currency: string,
  locale: Locale = "en",
  period: HealthPeriod = "30d",
  customDays?: number,
): Promise<HealthReportBundle | null> {
  const t = serverT(locale);
  const days = healthPeriodDays(period, customDays);
  const { from, to, prevFrom, prevTo } = healthPeriodBounds(period, customDays);
  const invLookback = clamp(days, 14, 90);

  const [totals, prevTotals, prevPrevTotals, curOrders, prevOrders, inv, cust, prevCust, atRisk, expCur, expPrev, expPrevPrev, profit, topProducts, topBranches] =
    await Promise.all([
      getPeriodTotals(companyId, from, to),
      getPeriodTotals(companyId, prevFrom, prevTo),
      getPeriodTotals(companyId, startOfDay(addDays(prevFrom, -days)), endOfDay(addDays(prevFrom, -1))),
      getOrderCounts(companyId, from, to),
      getOrderCounts(companyId, prevFrom, prevTo),
      getInventoryIntelligence(companyId, invLookback),
      getCustomerStats(companyId, from, to),
      getCustomerStats(companyId, prevFrom, prevTo),
      getAtRiskCustomers(companyId, 45, 10),
      getExpenseByCategory(companyId, from, to),
      getExpenseByCategory(companyId, prevFrom, prevTo),
      getExpenseByCategory(companyId, startOfDay(addDays(prevFrom, -days)), endOfDay(addDays(prevFrom, -1))),
      getProfitIntelligence(companyId, from, to, prevFrom, prevTo),
      getTopProducts(companyId, from, to, 5),
      getTopBranches(companyId, from, to, 5),
    ]);

  const totalCustomers = cust.totalCustomers;
  const refundRate = curOrders.completed > 0 ? curOrders.refunded / curOrders.completed : 0;
  const prevRefundRate = prevOrders.completed > 0 ? prevOrders.refunded / prevOrders.completed : 0;
  const expTotal = expCur.reduce((a, e) => a + e.amount, 0);
  const prevExpTotal = expPrev.reduce((a, e) => a + e.amount, 0);
  const prevPrevExpTotal = expPrevPrev.reduce((a, e) => a + e.amount, 0);
  const coverage = avgCoverageDays(inv);
  const healthyShare = inv.totalSkus > 0 ? 1 - (inv.lowCount + inv.outCount) / inv.totalSkus : 1;

  const input: HealthAreaInput = {
    revenueGrowth: prevTotals.revenue > 0 ? (totals.revenue - prevTotals.revenue) / Math.abs(prevTotals.revenue) : 0,
    orderGrowth: prevTotals.orders > 0 ? (totals.orders - prevTotals.orders) / prevTotals.orders : 0,
    aovGrowth: prevTotals.avgOrderValue > 0 ? (totals.avgOrderValue - prevTotals.avgOrderValue) / Math.abs(prevTotals.avgOrderValue) : 0,
    margin: totals.revenue > 0 ? totals.grossProfit / totals.revenue : 0,
    profitGrowth: Math.abs(prevTotals.grossProfit) > 0 ? (totals.grossProfit - prevTotals.grossProfit) / Math.abs(prevTotals.grossProfit) : 0,
    healthyStockShare: healthyShare,
    avgCoverageDays: coverage,
    overstockShare: inv.totalSkus > 0 ? inv.overstockCount / inv.totalSkus : 0,
    repeatRate: cust.repeatRate,
    activeCustomerShare: totalCustomers > 0 ? cust.activeCustomers / totalCustomers : 0,
    atRiskShare: totalCustomers > 0 ? atRisk.length / totalCustomers : 0,
    refundRate,
    cashFlowRatio: totals.revenue > 0 ? totals.cashFlow / totals.revenue : 0,
    expenseGrowth: prevExpTotal > 0 ? (expTotal - prevExpTotal) / Math.abs(prevExpTotal) : expTotal > 0 ? 1 : 0,
    hasEnoughData: totals.orders > 0 || totals.revenue > 0 || prevTotals.orders > 0,
  };
  const health = computeHealthAreas(input);

  const prevInput: HealthAreaInput = {
    revenueGrowth: prevPrevTotals.revenue > 0 ? (prevTotals.revenue - prevPrevTotals.revenue) / Math.abs(prevPrevTotals.revenue) : 0,
    orderGrowth: prevPrevTotals.orders > 0 ? (prevTotals.orders - prevPrevTotals.orders) / prevTotals.orders : 0,
    aovGrowth: prevPrevTotals.avgOrderValue > 0 ? (prevTotals.avgOrderValue - prevPrevTotals.avgOrderValue) / Math.abs(prevPrevTotals.avgOrderValue) : 0,
    margin: prevTotals.revenue > 0 ? prevTotals.grossProfit / prevTotals.revenue : 0,
    profitGrowth: Math.abs(prevPrevTotals.grossProfit) > 0 ? (prevTotals.grossProfit - prevPrevTotals.grossProfit) / Math.abs(prevPrevTotals.grossProfit) : 0,
    healthyStockShare: healthyShare,
    avgCoverageDays: coverage,
    overstockShare: inv.totalSkus > 0 ? inv.overstockCount / inv.totalSkus : 0,
    repeatRate: prevCust.repeatRate,
    activeCustomerShare: prevCust.totalCustomers > 0 ? prevCust.activeCustomers / prevCust.totalCustomers : 0,
    atRiskShare: totalCustomers > 0 ? atRisk.length / totalCustomers : 0,
    refundRate: prevRefundRate,
    cashFlowRatio: prevTotals.revenue > 0 ? prevTotals.cashFlow / prevTotals.revenue : 0,
    expenseGrowth: prevPrevExpTotal > 0 ? (prevExpTotal - prevPrevExpTotal) / Math.abs(prevPrevExpTotal) : prevExpTotal > 0 ? 1 : 0,
    hasEnoughData: prevTotals.orders > 0 || prevTotals.revenue > 0 || prevPrevTotals.orders > 0,
  };
  const prevHealth = computeHealthAreas(prevInput);

  const change =
    health.overall !== null && prevHealth.overall !== null ? round2(health.overall - prevHealth.overall) : null;

  const areaCtx = { t, currency, locale, totals, prevTotals, prevPrevTotals, inv, cust, prevCust, atRiskCount: atRisk.length, totalCustomers, refundRate, prevRefundRate, expTotal, prevExpTotal, prevPrevExpTotal };

  const areas = composeAreas(health, areaCtx);
  const kpis = composeKpis({ t, currency, locale, totals, prevTotals });
  const diagnosis = composeDiagnosis({ t, currency, locale, totals, prevTotals, input, inv, cust, atRiskCount: atRisk.length, refundRate, expTotal, prevExpTotal });
  const risks = composeRisks({ t, inv, atRiskCount: atRisk.length, profit, margin: input.margin, cashFlowRatio: input.cashFlowRatio, refundRate });
  const opportunities = composeOpportunities({ t, currency, locale, inv, profit, atRiskCount: atRisk.length });
  const actionPlan = composeActionPlan({ t, inv, inProfit: profit.grossProfit, cashFlowRatio: input.cashFlowRatio, atRiskCount: atRisk.length, expTotal, prevExpTotal });

  return {
    meta: {
      companyName,
      currency,
      locale,
      period,
      customDays: period === "custom" ? days : null,
      days,
      from: formatDate(from, locale),
      to: formatDate(to, locale),
      generatedAt: new Date().toISOString(),
    },
    headline: {
      score: health.overall,
      status: health.status,
      statusLabel: statusLabel(health.status, t),
      summary: headlineSummary(health.status, health.overall, t),
      prevScore: prevHealth.overall,
      change,
    },
    areas,
    kpis,
    diagnosis,
    risks,
    opportunities,
    actionPlan,
    topProducts,
    topBranches,
    profit,
    inventory: {
      totalSkus: inv.totalSkus,
      totalUnits: inv.totalUnits,
      stockValue: inv.stockValue,
      lowCount: inv.lowCount,
      criticalCount: inv.criticalCount,
      outCount: inv.outCount,
      overstockCount: inv.overstockCount,
      criticalItems: inv.critical.slice(0, 5),
    },
    atRiskCustomers: atRisk,
  };
}

function statusLabel(status: HealthAreas["status"], t: T): string {
  switch (status) {
    case "HEALTHY": return t("health.status.HEALTHY");
    case "NEEDS_ATTENTION": return t("health.status.NEEDS_ATTENTION");
    case "AT_RISK": return t("health.status.AT_RISK");
    case "CRITICAL": return t("health.status.CRITICAL");
    default: return t("health.status.INSUFFICIENT_DATA");
  }
}

function headlineSummary(status: HealthAreas["status"], score: number | null, t: T): string {
  switch (status) {
    case "HEALTHY": return t("health.summary.HEALTHY");
    case "NEEDS_ATTENTION": return t("health.summary.NEEDS_ATTENTION");
    case "AT_RISK": return t("health.summary.AT_RISK");
    case "CRITICAL": return t("health.summary.CRITICAL");
    default: return t("health.summary.INSUFFICIENT_DATA");
  }
}

interface AreaCtx {
  t: T;
  currency: string;
  locale: Locale;
  totals: PeriodTotals;
  prevTotals: PeriodTotals;
  prevPrevTotals: PeriodTotals;
  inv: InventoryIntelligence;
  cust: { totalCustomers: number; activeCustomers: number; repeatRate: number };
  prevCust: { totalCustomers: number; activeCustomers: number; repeatRate: number };
  atRiskCount: number;
  totalCustomers: number;
  refundRate: number;
  prevRefundRate: number;
  expTotal: number;
  prevExpTotal: number;
  prevPrevExpTotal: number;
}

function composeAreas(health: HealthAreas, ctx: AreaCtx): HealthAreaReport[] {
  const { t, currency, locale, totals, prevTotals, inv, cust, atRiskCount, totalCustomers, refundRate, expTotal, prevExpTotal } = ctx;
  const money = (v: number) => formatCurrency(v, currency, true, locale);
  const pct = (v: number | null) => nicePct(v);

  const revGrowth = prevTotals.revenue > 0 ? (totals.revenue - prevTotals.revenue) / Math.abs(prevTotals.revenue) : null;
  const orderGrowth = prevTotals.orders > 0 ? (totals.orders - prevTotals.orders) / prevTotals.orders : null;
  const aovGrowth = prevTotals.avgOrderValue > 0 ? (totals.avgOrderValue - prevTotals.avgOrderValue) / Math.abs(prevTotals.avgOrderValue) : null;
  const margin = totals.revenue > 0 ? totals.grossProfit / totals.revenue : 0;
  const profitGrowth = Math.abs(prevTotals.grossProfit) > 0 ? (totals.grossProfit - prevTotals.grossProfit) / Math.abs(prevTotals.grossProfit) : null;
  const coverage = avgCoverageDays(inv);
  const healthyShare = inv.totalSkus > 0 ? 1 - (inv.lowCount + inv.outCount) / inv.totalSkus : 1;
  const atRiskShare = totalCustomers > 0 ? atRiskCount / totalCustomers : 0;
  const cashRatio = totals.revenue > 0 ? totals.cashFlow / totals.revenue : null;
  const expenseGrowth = prevExpTotal > 0 ? (expTotal - prevExpTotal) / Math.abs(prevExpTotal) : null;

  const salesFindings: string[] = [];
  if (revGrowth !== null && revGrowth <= -0.1) salesFindings.push(t("health.findings.revDown", { pct: pct(revGrowth) }));
  if (orderGrowth !== null && orderGrowth <= -0.1) salesFindings.push(t("health.findings.ordersDown", { pct: pct(orderGrowth) }));
  if (aovGrowth !== null && aovGrowth <= -0.05) salesFindings.push(t("health.findings.aovDown", { pct: pct(aovGrowth) }));
  if (salesFindings.length === 0) salesFindings.push(t("health.findings.salesOk"));

  const profitFindings: string[] = [];
  if (margin < 0.15) profitFindings.push(t("health.findings.marginThin", { pct: formatPercent(margin, 0) }));
  if (profitGrowth !== null && profitGrowth <= -0.1) profitFindings.push(t("health.findings.profitDown", { pct: pct(profitGrowth) }));
  if (totals.netProfit < 0) profitFindings.push(t("health.findings.netNegative", { value: money(totals.netProfit) }));
  if (profitFindings.length === 0) profitFindings.push(t("health.findings.profitOk"));

  const invFindings: string[] = [];
  if (inv.criticalCount > 0) invFindings.push(t("health.findings.stockout", { count: String(inv.criticalCount) }));
  if (inv.overstockCount > 0) invFindings.push(t("health.findings.overstock", { count: String(inv.overstockCount) }));
  if (coverage !== null && coverage < 10) invFindings.push(t("health.findings.coverageLow", { days: String(Math.round(coverage)) }));
  if (invFindings.length === 0) invFindings.push(t("health.findings.inventoryOk"));

  const custFindings: string[] = [];
  if (cust.repeatRate < 0.2) custFindings.push(t("health.findings.repeatLow", { pct: formatPercent(cust.repeatRate, 0) }));
  if (atRiskCount > 0) custFindings.push(t("health.findings.churn", { count: String(atRiskCount) }));
  if (cust.totalCustomers > 0 && cust.activeCustomers / cust.totalCustomers < 0.25) custFindings.push(t("health.findings.activeLow", { pct: formatPercent(cust.activeCustomers / cust.totalCustomers, 0) }));
  if (custFindings.length === 0) custFindings.push(t("health.findings.customersOk"));

  const opsFindings: string[] = [];
  if (cashRatio !== null && cashRatio < 0) opsFindings.push(t("health.findings.cashNegative"));
  if (refundRate > 0.1) opsFindings.push(t("health.findings.refundHigh", { pct: formatPercent(refundRate, 0) }));
  if (expenseGrowth !== null && expenseGrowth > 0.2) opsFindings.push(t("health.findings.expenseUp", { pct: pct(expenseGrowth) }));
  if (opsFindings.length === 0) opsFindings.push(t("health.findings.operationsOk"));

  return [
    {
      key: "sales",
      score: health.sales,
      label: t("health.areas.sales"),
      summary: adviceTier(health.sales, t("health.advice.salesStrong"), t("health.advice.salesOk"), t("health.advice.salesWeak")),
      signals: [
        { key: "revenueGrowth", label: t("health.signals.revenueGrowth"), value: pct(revGrowth), status: sigStatus(revGrowth, true, 0.1, -0.1), goodWhenUp: true },
        { key: "orderGrowth", label: t("health.signals.orderGrowth"), value: pct(orderGrowth), status: sigStatus(orderGrowth, true, 0.1, -0.1), goodWhenUp: true },
        { key: "aovGrowth", label: t("health.signals.aovGrowth"), value: pct(aovGrowth), status: sigStatus(aovGrowth, true, 0.05, -0.05), goodWhenUp: true },
      ],
      findings: salesFindings,
    },
    {
      key: "profit",
      score: health.profit,
      label: t("health.areas.profit"),
      summary: adviceTier(health.profit, t("health.advice.profitStrong"), t("health.advice.profitOk"), t("health.advice.profitWeak")),
      signals: [
        { key: "grossMargin", label: t("health.signals.grossMargin"), value: formatPercent(margin, 0), status: sigStatus(margin, true, 0.2, 0.1), goodWhenUp: true },
        { key: "profitGrowth", label: t("health.signals.profitGrowth"), value: pct(profitGrowth), status: sigStatus(profitGrowth, true, 0.1, -0.1), goodWhenUp: true },
        { key: "netProfit", label: t("health.signals.netProfit"), value: money(totals.netProfit), status: totals.netProfit >= 0 ? "good" : "bad", goodWhenUp: true },
      ],
      findings: profitFindings,
    },
    {
      key: "inventory",
      score: health.inventory,
      label: t("health.areas.inventory"),
      summary: adviceTier(health.inventory, t("health.advice.invStrong"), t("health.advice.invOk"), t("health.advice.invWeak")),
      signals: [
        { key: "healthyStock", label: t("health.signals.healthyStock"), value: formatPercent(healthyShare, 0), status: sigStatus(healthyShare, true, 0.9, 0.7), goodWhenUp: true },
        { key: "avgCoverage", label: t("health.signals.avgCoverage"), value: coverage === null ? "—" : `${formatNumber(coverage, 1, locale)} ${t("today.unitsDays")}`, status: coverage === null ? "neutral" : sigStatus(coverage, true, 30, 7), goodWhenUp: true },
        { key: "overstock", label: t("health.signals.overstock"), value: formatPercent(inv.overstockCount > 0 ? inv.overstockCount / Math.max(1, inv.totalSkus) : 0, 0), status: sigStatus(inv.overstockCount > 0 ? inv.overstockCount / Math.max(1, inv.totalSkus) : 0, false, 0.05, 0.2), goodWhenUp: false },
      ],
      findings: invFindings,
    },
    {
      key: "customers",
      score: health.customers,
      label: t("health.areas.customers"),
      summary: adviceTier(health.customers, t("health.advice.custStrong"), t("health.advice.custOk"), t("health.advice.custWeak")),
      signals: [
        { key: "repeatRate", label: t("health.signals.repeatRate"), value: formatPercent(cust.repeatRate, 0), status: sigStatus(cust.repeatRate, true, 0.3, 0.15), goodWhenUp: true },
        { key: "activeShare", label: t("health.signals.activeShare"), value: formatPercent(cust.totalCustomers > 0 ? cust.activeCustomers / cust.totalCustomers : 0, 0), status: sigStatus(cust.totalCustomers > 0 ? cust.activeCustomers / cust.totalCustomers : null, true, 0.5, 0.25), goodWhenUp: true },
        { key: "atRiskShare", label: t("health.signals.atRiskShare"), value: formatPercent(atRiskShare, 0), status: sigStatus(atRiskShare, false, 0.1, 0.25), goodWhenUp: false },
      ],
      findings: custFindings,
    },
    {
      key: "operations",
      score: health.operations,
      label: t("health.areas.operations"),
      summary: adviceTier(health.operations, t("health.advice.opsStrong"), t("health.advice.opsOk"), t("health.advice.opsWeak")),
      signals: [
        { key: "refundRate", label: t("health.signals.refundRate"), value: formatPercent(refundRate, 0), status: sigStatus(refundRate, false, 0.05, 0.15), goodWhenUp: false },
        { key: "cashRatio", label: t("health.signals.cashRatio"), value: cashRatio === null ? "—" : formatPercent(cashRatio, 0), status: sigStatus(cashRatio, true, 0.2, -0.1), goodWhenUp: true },
        { key: "expenseGrowth", label: t("health.signals.expenseGrowth"), value: pct(expenseGrowth), status: sigStatus(expenseGrowth, false, 0.05, 0.2), goodWhenUp: false },
      ],
      findings: opsFindings,
    },
  ];
}

function composeKpis(ctx: { t: T; currency: string; locale: Locale; totals: PeriodTotals; prevTotals: PeriodTotals }): HealthKpi[] {
  const { t, currency, locale, totals, prevTotals } = ctx;
  const fmt = (v: number) => formatCurrency(v, currency, false, locale);
  const delta = (cur: number, prev: number) => (prev !== 0 ? round2(((cur - prev) / Math.abs(prev)) * 100) : null);
  const item = (key: string, label: string, cur: number, prev: number, goodWhenUp = true): HealthKpi => ({
    key, label,
    current: fmt(cur),
    previous: fmt(prev),
    deltaPct: delta(cur, prev),
    goodWhenUp,
  });

  const marginCur = totals.revenue > 0 ? totals.grossProfit / totals.revenue : 0;
  const marginPrev = prevTotals.revenue > 0 ? prevTotals.grossProfit / prevTotals.revenue : 0;
  const marginDelta = delta(marginCur * 100, marginPrev * 100);

  return [
    item("revenue", t("health.kpis.revenue"), totals.revenue, prevTotals.revenue),
    item("grossProfit", t("health.kpis.grossProfit"), totals.grossProfit, prevTotals.grossProfit),
    item("netProfit", t("health.kpis.netProfit"), totals.netProfit, prevTotals.netProfit),
    item("orders", t("health.kpis.orders"), totals.orders, prevTotals.orders),
    item("aov", t("health.kpis.aov"), totals.avgOrderValue, prevTotals.avgOrderValue),
    { key: "grossMargin", label: t("health.kpis.grossMargin"), current: formatPercent(marginCur, 0), previous: formatPercent(marginPrev, 0), deltaPct: marginDelta, goodWhenUp: true },
  ];
}

function composeDiagnosis(ctx: {
  t: T; currency: string; locale: Locale; totals: PeriodTotals; prevTotals: PeriodTotals;
  input: HealthAreaInput; inv: InventoryIntelligence; cust: { totalCustomers: number; repeatRate: number };
  atRiskCount: number; refundRate: number; expTotal: number; prevExpTotal: number;
}): string[] {
  const { t, currency, locale, totals, prevTotals, inv, atRiskCount, refundRate, expTotal, prevExpTotal } = ctx;
  const money = (v: number) => formatCurrency(v, currency, false, locale);
  const items: string[] = [];
  const revDelta = prevTotals.revenue > 0 ? (totals.revenue - prevTotals.revenue) / Math.abs(prevTotals.revenue) : null;
  if (revDelta !== null && revDelta <= -0.05) items.push(t("health.diagnosis.revDown", { pct: nicePct(revDelta) }));
  if (totals.revenue > 0 && totals.grossProfit / totals.revenue < 0.15) items.push(t("health.diagnosis.marginThin", { pct: formatPercent(totals.grossProfit / totals.revenue, 0) }));
  if (totals.netProfit < 0) items.push(t("health.diagnosis.netNegative", { value: money(totals.netProfit) }));
  const expGrowth = prevExpTotal > 0 ? (expTotal - prevExpTotal) / Math.abs(prevExpTotal) : null;
  if (expGrowth !== null && expGrowth > 0.2) items.push(t("health.diagnosis.expenseSpike", { pct: nicePct(expGrowth) }));
  if (inv.criticalCount > 0) items.push(t("health.diagnosis.stockout", { count: String(inv.criticalCount) }));
  if (inv.overstockCount > 0) items.push(t("health.diagnosis.overstock", { count: String(inv.overstockCount) }));
  if (atRiskCount > 0) items.push(t("health.diagnosis.churn", { count: String(atRiskCount) }));
  if (refundRate > 0.1) items.push(t("health.diagnosis.refundHigh", { pct: formatPercent(refundRate, 0) }));
  if (items.length === 0) items.push(t("health.diagnosis.none"));
  return items;
}

function composeRisks(ctx: { t: T; inv: InventoryIntelligence; atRiskCount: number; profit: ProfitIntelligence; margin: number; cashFlowRatio: number; refundRate: number }): HealthRisk[] {
  const { t, inv, atRiskCount, profit, margin, cashFlowRatio, refundRate } = ctx;
  const risks: HealthRisk[] = [];

  const stockouts = inv.critical.slice(0, 3);
  if (stockouts.length > 0) {
    risks.push({ title: t("health.risks.stockoutTitle"), severity: "high", description: t("health.risks.stockoutDesc", { names: stockouts.map((p) => p.name).join(", ") }) });
  }
  if (cashFlowRatio < 0) {
    risks.push({ title: t("health.risks.cashTitle"), severity: "high", description: t("health.risks.cashDesc") });
  }
  if (margin < 0.1 || profit.lowMarginProducts.length > 0) {
    risks.push({ title: t("health.risks.marginTitle"), severity: "medium", description: t("health.risks.marginDesc", { names: profit.lowMarginProducts.slice(0, 3).map((p) => p.name).join(", ") }) });
  }
  if (atRiskCount > 0) {
    risks.push({ title: t("health.risks.churnTitle"), severity: "medium", description: t("health.risks.churnDesc", { count: String(atRiskCount), days: "45" }) });
  }
  if (refundRate > 0.1) {
    risks.push({ title: t("health.risks.refundTitle"), severity: "medium", description: t("health.risks.refundDesc", { pct: formatPercent(refundRate, 0) }) });
  }
  if (inv.overstockCount > 0) {
    risks.push({ title: t("health.risks.overstockTitle"), severity: "low", description: t("health.risks.overstockDesc", { count: String(inv.overstockCount) }) });
  }
  return risks;
}

function composeOpportunities(ctx: { t: T; currency: string; locale: Locale; inv: InventoryIntelligence; profit: ProfitIntelligence; atRiskCount: number }): HealthOpportunity[] {
  const { t, currency, locale, inv, profit, atRiskCount } = ctx;
  const money = (v: number) => formatCurrency(v, currency, false, locale);
  const out: HealthOpportunity[] = [];

  const fast = inv.restockRecommendations.filter((r) => (r.estimatedDaysRemaining ?? Infinity) <= 3).slice(0, 3);
  if (fast.length > 0) {
    const atRiskRevenue = profit.topProfitProducts.filter((p) => fast.some((f) => f.productId === p.productId)).reduce((a, p) => a + p.revenue, 0);
    out.push({
      title: t("health.opps.restockTitle", { names: fast.map((f) => f.name).join(", ") }),
      impact: atRiskRevenue > 0 ? t("health.opps.restockImpact", { value: money(atRiskRevenue) }) : t("health.opps.restockImpactFallback"),
      description: t("health.opps.restockDesc"),
    });
  }

  if (profit.lowMarginProducts.length > 0) {
    const worst = profit.lowMarginProducts[0];
    out.push({
      title: t("health.opps.marginTitle"),
      impact: t("health.opps.marginImpact", { pct: formatPercent(worst.margin, 0) }),
      description: t("health.opps.marginDesc", { name: worst.name }),
    });
  }

  if (atRiskCount > 0) {
    out.push({
      title: t("health.opps.winbackTitle"),
      impact: t("health.opps.winbackImpact", { count: String(atRiskCount) }),
      description: t("health.opps.winbackDesc"),
    });
  }

  if (profit.topProfitProducts.length > 0) {
    const top = profit.topProfitProducts[0];
    out.push({
      title: t("health.opps.bundleTitle", { name: top.name }),
      impact: t("health.opps.bundleImpact", { value: money(top.revenue) }),
      description: t("health.opps.bundleDesc"),
    });
  }

  return out;
}

function composeActionPlan(ctx: { t: T; inv: InventoryIntelligence; inProfit: number; cashFlowRatio: number; atRiskCount: number; expTotal: number; prevExpTotal: number }): HealthAction[] {
  const { t, inv, inProfit, cashFlowRatio, atRiskCount, expTotal, prevExpTotal } = ctx;
  const actions: HealthAction[] = [];
  const area = (key: string) => t(`health.areas.${key}`);

  const urgent = inv.restockRecommendations.slice(0, 4);
  if (urgent.length > 0) {
    actions.push({ priority: "high", action: t("health.actions.restock", { count: String(urgent.length) }), area: area("inventory"), impact: t("health.actions.restockImpact") });
  }

  if (cashFlowRatio < 0 || inProfit < 0) {
    actions.push({ priority: "high", action: t("health.actions.cash", { value: expTotal > prevExpTotal ? nicePct((expTotal - prevExpTotal) / Math.max(1, prevExpTotal)) : "0%" }), area: area("operations"), impact: t("health.actions.cashImpact") });
  }

  if (atRiskCount > 0) {
    actions.push({ priority: "medium", action: t("health.actions.winback", { count: String(atRiskCount) }), area: area("customers"), impact: t("health.actions.winbackImpact") });
  }

  if (inv.overstockCount > 0) {
    actions.push({ priority: "medium", action: t("health.actions.clearOverstock", { count: String(inv.overstockCount) }), area: area("inventory"), impact: t("health.actions.clearOverstockImpact") });
  }

  if (inv.totalSkus === 0 || actions.length === 0) {
    actions.push({ priority: "low", action: t("health.actions.steady"), area: area("sales"), impact: t("health.actions.steadyImpact") });
  }

  return actions;
}