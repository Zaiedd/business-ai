import type { DateRange } from "@/lib/validators";
import type { Locale } from "@/lib/i18n";
import { serverT } from "@/lib/i18n/server";
import { round2 } from "@/lib/utils";
import {
  computeHealthScore,
  getAtRiskCustomers,
  getCustomerStats,
  getDailySeries,
  getExpenseByCategory,
  getPeriodTotals,
  getRecentSales,
  getStockStatus,
  getTopBranches,
  getTopEmployees,
  getTopProducts,
  linearForecast,
  rangeToBounds,
} from "@/server/analytics";
import { generateInsights } from "@/server/ai/insights";
import type { ForecastResult, Insight } from "@/server/ai/types";
import { addDays, dayKey } from "@/lib/utils";

export interface DashboardBundle {
  meta: { asOf: Date; currency: string; range: DateRange };
  overview: ReturnType<typeof computeHealthScore> & {
    current: import("@/server/analytics").PeriodTotals;
    previous: import("@/server/analytics").PeriodTotals;
    deltas: { revenue: number; expenses: number; netProfit: number; orders: number };
  };
  series: import("@/server/analytics").DailyPoint[];
  topProducts: import("@/server/analytics").ProductPerformance[];
  expenseByCategory: import("@/server/analytics").ExpenseSlice[];
  topBranches: import("@/server/analytics").BranchPerformance[];
  topEmployees: import("@/server/analytics").EmployeePerformance[];
  recentSales: Awaited<ReturnType<typeof getRecentSales>>;
  customerStats: Awaited<ReturnType<typeof getCustomerStats>>;
  lowStock: Awaited<ReturnType<typeof getStockStatus>>["low"];
  atRiskCustomers: import("@/server/analytics").AtRiskCustomer[];
  insights: Insight[];
  alerts: Insight[];
  forecast: ForecastResult;
}

export async function getDashboardBundle(companyId: string, range: DateRange, currency: string, locale: Locale = "en"): Promise<DashboardBundle> {
  const { from, to, prevFrom, prevTo } = rangeToBounds(range);

  const [cur, prev, series, topProducts, expenseByCategory, topBranches, topEmployees, recentSales, customerStats, stock, atRisk, insights] =
    await Promise.all([
      getPeriodTotals(companyId, from, to),
      getPeriodTotals(companyId, prevFrom, prevTo),
      getDailySeries(companyId, from, to),
      getTopProducts(companyId, from, to, 6),
      getExpenseByCategory(companyId, from, to),
      getTopBranches(companyId, from, to, 6),
      getTopEmployees(companyId, from, to, 6),
      getRecentSales(companyId, 8),
      getCustomerStats(companyId, from, to),
      getStockStatus(companyId),
      getAtRiskCustomers(companyId, 45, 6),
      generateInsights(companyId, range, currency, locale),
    ]);

  const pct = (cur: number, prev: number) => (prev !== 0 ? (cur - prev) / Math.abs(prev) : cur !== 0 ? 1 : 0);

  const deltas = {
    revenue: pct(cur.revenue, prev.revenue),
    expenses: pct(cur.expenses, prev.expenses),
    netProfit: prev.netProfit !== 0 ? (cur.netProfit - prev.netProfit) / Math.abs(prev.netProfit) : 0,
    orders: pct(cur.orders, prev.orders),
  };

  const health = computeHealthScore(cur, prev, customerStats);
  const t = serverT(locale);
  const HEALTH_KEY: Record<string, string> = { Excellent: "excellent", Good: "good", Fair: "fair", "At risk": "atRisk" };
  const label = t(`ai.healthLabels.${HEALTH_KEY[health.label] ?? "atRisk"}`);

  // Forecast: linear regression on the most recent 30 daily revenue points.
  const window = series.slice(-30).map((p, i) => ({ x: i, y: p.revenue }));
  const horizon = 14;
  const fc = linearForecast(window, horizon);
  const recentAvg = window.length > 0 ? window.reduce((a, p) => a + p.y, 0) / window.length : 0;
  const predictedTotal = fc.next.reduce((a, b) => a + b, 0);
  const predictedAvg = fc.next.length > 0 ? predictedTotal / fc.next.length : 0;
  const growthRate = recentAvg > 0 ? predictedAvg / recentAvg - 1 : 0;
  const trend: ForecastResult["trend"] = fc.slope > 0.5 ? "up" : fc.slope < -0.5 ? "down" : "flat";

  const lastDate = series.length > 0 ? new Date(series[series.length - 1].date) : new Date();
  const forecast: ForecastResult = {
    horizonDays: horizon,
    predictedTotal: round2(predictedTotal),
    predictedAveragePerDay: round2(predictedAvg),
    growthRate: round2(growthRate),
    trend,
    points: fc.next.map((value, i) => ({
      date: dayKey(addDays(lastDate, i + 1)),
      value: round2(value),
    })),
  };

  return {
    meta: { asOf: new Date(), currency, range },
    overview: { current: cur, previous: prev, deltas, score: health.score, label },
    series,
    topProducts,
    expenseByCategory,
    topBranches,
    topEmployees,
    recentSales,
    customerStats,
    lowStock: stock.low,
    atRiskCustomers: atRisk,
    insights,
    alerts: insights.filter((i) => i.severity === "critical" || i.severity === "warning"),
    forecast,
  };
}
