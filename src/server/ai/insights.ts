import { formatCurrency, round2 } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import { serverT } from "@/lib/i18n/server";
import type { DateRange } from "@/lib/validators";
import {
  computeHealthScore,
  getAtRiskCustomers,
  getCustomerStats,
  getDailySeries,
  getExpenseByCategory,
  getPeriodTotals,
  getStockStatus,
  getTopBranches,
  getTopEmployees,
  getTopProducts,
  rangeToBounds,
} from "@/server/analytics";
import type { Insight } from "@/server/ai/types";

const HEALTH_KEY: Record<string, string> = {
  Excellent: "excellent",
  Good: "good",
  Fair: "fair",
  "At risk": "atRisk",
};

/**
 * Built-in deterministic AI engine.
 *
 * Zero cost, zero external dependencies: it analyzes real data with business
 * rules + statistical methods and produces concrete, actionable insights in
 * the user's locale. Swap for an LLM-backed provider later via the pluggable
 * AI layer without touching the dashboard.
 */
export async function generateInsights(
  companyId: string,
  range: DateRange,
  currency: string,
  locale: Locale = "en",
): Promise<Insight[]> {
  const t = serverT(locale);
  const { from, to, prevFrom, prevTo } = rangeToBounds(range);
  const [cur, prev, series, products, branches, employees, expenses, prevExpenses, stock, atRisk, customerStats] = await Promise.all([
    getPeriodTotals(companyId, from, to),
    getPeriodTotals(companyId, prevFrom, prevTo),
    getDailySeries(companyId, from, to),
    getTopProducts(companyId, from, to, 6),
    getTopBranches(companyId, from, to, 6),
    getTopEmployees(companyId, from, to, 6),
    getExpenseByCategory(companyId, from, to),
    getExpenseByCategory(companyId, prevFrom, prevTo),
    getStockStatus(companyId),
    getAtRiskCustomers(companyId, 45, 6),
    getCustomerStats(companyId, from, to),
  ]);

  const insights: Insight[] = [];
  const fmt = (v: number) => formatCurrency(v, currency);
  const ml = (key: string) => t(`ai.metricLabels.${key}`);
  const health = computeHealthScore(cur, prev, customerStats);
  const healthLabel = t(`ai.healthLabels.${HEALTH_KEY[health.label] ?? "atRisk"}`);

  // 1. Revenue trend
  const revGrowth = prev.revenue > 0 ? (cur.revenue - prev.revenue) / prev.revenue : 0;
  if (revGrowth < -0.05) {
    insights.push({
      id: "rev-down",
      type: "revenue",
      severity: "warning",
      title: t("ai.insights.rev-down.title"),
      description: t("ai.insights.rev-down.description", {
        growth: `${(Math.abs(revGrowth) * 100).toFixed(1)}`,
        cur: fmt(cur.revenue),
        prev: fmt(prev.revenue),
      }),
      recommendation: t("ai.insights.rev-down.recommendation"),
      metric: { label: ml("revenue"), value: fmt(cur.revenue), delta: `${(revGrowth * 100).toFixed(1)}%` },
    });
  } else if (revGrowth > 0.05) {
    insights.push({
      id: "rev-up",
      type: "revenue",
      severity: "success",
      title: t("ai.insights.rev-up.title"),
      description: t("ai.insights.rev-up.description", {
        growth: `${(revGrowth * 100).toFixed(1)}`,
        cur: fmt(cur.revenue),
        prev: fmt(prev.revenue),
      }),
      recommendation: t("ai.insights.rev-up.recommendation"),
      metric: { label: ml("revenue"), value: fmt(cur.revenue), delta: `+${(revGrowth * 100).toFixed(1)}%` },
    });
  } else {
    insights.push({
      id: "rev-flat",
      type: "revenue",
      severity: "info",
      title: t("ai.insights.rev-flat.title"),
      description: t("ai.insights.rev-flat.description", { cur: fmt(cur.revenue) }),
      recommendation: t("ai.insights.rev-flat.recommendation"),
      metric: { label: ml("revenue"), value: fmt(cur.revenue) },
    });
  }

  // 2. Profit trend
  const profitGrowth = prev.netProfit !== 0 ? (cur.netProfit - prev.netProfit) / Math.abs(prev.netProfit) : 0;
  if (cur.netProfit < 0) {
    insights.push({
      id: "profit-negative",
      type: "profit",
      severity: "critical",
      title: t("ai.insights.profit-negative.title"),
      description: t("ai.insights.profit-negative.description", { netProfit: fmt(cur.netProfit), revenue: fmt(cur.revenue) }),
      recommendation: t("ai.insights.profit-negative.recommendation"),
      metric: { label: ml("netProfit"), value: fmt(cur.netProfit) },
    });
  } else if (profitGrowth < -0.1) {
    insights.push({
      id: "profit-drop",
      type: "profit",
      severity: "warning",
      title: t("ai.insights.profit-drop.title"),
      description: t("ai.insights.profit-drop.description", { growth: `${(Math.abs(profitGrowth) * 100).toFixed(1)}`, netProfit: fmt(cur.netProfit) }),
      recommendation: t("ai.insights.profit-drop.recommendation"),
      metric: { label: ml("netProfit"), value: fmt(cur.netProfit), delta: `${(profitGrowth * 100).toFixed(1)}%` },
    });
  } else if (profitGrowth > 0.1) {
    insights.push({
      id: "profit-up",
      type: "profit",
      severity: "success",
      title: t("ai.insights.profit-up.title"),
      description: t("ai.insights.profit-up.description", { growth: `${(profitGrowth * 100).toFixed(1)}`, netProfit: fmt(cur.netProfit) }),
      metric: { label: ml("netProfit"), value: fmt(cur.netProfit), delta: `+${(profitGrowth * 100).toFixed(1)}%` },
    });
  }

  // 3. Margin health
  if (cur.margin < 0.05 && cur.revenue > 0) {
    insights.push({
      id: "margin-low",
      type: "margin",
      severity: "warning",
      title: t("ai.insights.margin-low.title"),
      description: t("ai.insights.margin-low.description", { margin: `${(cur.margin * 100).toFixed(1)}` }),
      recommendation: t("ai.insights.margin-low.recommendation"),
      metric: { label: ml("netMargin"), value: `${(cur.margin * 100).toFixed(1)}%` },
    });
  }

  // 4. Expense spike
  const expenseGrowthByCat = prevExpenses.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = p.amount;
    return acc;
  }, {});
  const spike = expenses.find((e) => {
    const prevAmt = expenseGrowthByCat[e.category] ?? 0;
    return prevAmt > 0 && e.amount > prevAmt * 1.25 && e.amount / (cur.expenses || 1) > 0.1;
  });
  if (spike) {
    insights.push({
      id: "expense-spike",
      type: "expense",
      severity: "warning",
      title: t("ai.insights.expense-spike.title", { category: spike.category }),
      description: t("ai.insights.expense-spike.description", { category: spike.category, amount: fmt(spike.amount), prevAmount: fmt(expenseGrowthByCat[spike.category] ?? 0) }),
      recommendation: t("ai.insights.expense-spike.recommendation"),
      metric: { label: spike.category, value: fmt(spike.amount) },
    });
  }

  // 5. Top product
  if (products.length > 0) {
    const top = products[0];
    insights.push({
      id: "top-product",
      type: "product",
      severity: "success",
      title: t("ai.insights.top-product.title", { name: top.name }),
      description: t("ai.insights.top-product.description", { profit: fmt(top.profit), revenue: fmt(top.revenue), qty: String(top.qty) }),
      recommendation: t("ai.insights.top-product.recommendation"),
      metric: { label: ml("topProductProfit"), value: fmt(top.profit) },
    });
  }

  // 6. Branch performance
  if (branches.length > 1) {
    const best = branches[0];
    const worst = branches[branches.length - 1];
    const worstSegment =
      worst && worst.name !== best.name
        ? t("ai.insights.branch-best.worstSegment", { name: worst.name, revenue: fmt(worst.revenue) })
        : "";
    insights.push({
      id: "branch-best",
      type: "branch",
      severity: "info",
      title: t("ai.insights.branch-best.title", { name: best.name }),
      description: t("ai.insights.branch-best.description", { name: best.name, revenue: fmt(best.revenue), orders: String(best.orders), worst: worstSegment }),
      recommendation: t("ai.insights.branch-best.recommendation"),
      metric: { label: ml("bestBranchRevenue"), value: fmt(best.revenue) },
    });
  }

  // 7. Employee performance
  if (employees.length > 0 && employees[0].id) {
    const best = employees[0];
    insights.push({
      id: "employee-best",
      type: "employee",
      severity: "info",
      title: t("ai.insights.employee-best.title", { name: best.name }),
      description: t("ai.insights.employee-best.description", { name: best.name, orders: String(best.orders), revenue: fmt(best.revenue) }),
      recommendation: t("ai.insights.employee-best.recommendation"),
      metric: { label: ml("topSellerRevenue"), value: fmt(best.revenue) },
    });
  }

  // 8. Reorder recommendations (low stock)
  if (stock.low.length > 0) {
    const names = stock.low.slice(0, 3).map((p) => p.name).join(", ");
    const extra =
      stock.low.length > 3 ? t("ai.insights.reorder.extra", { n: String(stock.low.length - 3) }) : "";
    insights.push({
      id: "reorder",
      type: "inventory",
      severity: "warning",
      title:
        stock.low.length > 1
          ? t("ai.insights.reorder.titlePlural", { count: String(stock.low.length) })
          : t("ai.insights.reorder.title", { count: String(stock.low.length) }),
      description: t("ai.insights.reorder.description", { names, extra }),
      recommendation: t("ai.insights.reorder.recommendation"),
      metric: { label: ml("lowStock"), value: String(stock.low.length) },
    });
  }

  // 9. Overstock
  if (stock.top.length > 0 && stock.top[0].stockQty > stock.top[0].lowStockThreshold * 4) {
    const over = stock.top[0];
    insights.push({
      id: "overstock",
      type: "inventory",
      severity: "info",
      title: t("ai.insights.overstock.title", { name: over.name }),
      description: t("ai.insights.overstock.description", { name: over.name, stock: String(over.stockQty), level: String(over.lowStockThreshold) }),
      recommendation: t("ai.insights.overstock.recommendation"),
      metric: { label: ml("stockOnHand"), value: String(over.stockQty) },
    });
  }

  // 10. Cash flow
  if (cur.cashFlow < 0) {
    insights.push({
      id: "cashflow",
      type: "cashflow",
      severity: "critical",
      title: t("ai.insights.cashflow.title"),
      description: t("ai.insights.cashflow.description", { amount: fmt(-cur.cashFlow) }),
      recommendation: t("ai.insights.cashflow.recommendation"),
      metric: { label: ml("netCashFlow"), value: fmt(cur.cashFlow) },
    });
  }

  // 11. Customer churn risk
  if (atRisk.length >= 2) {
    insights.push({
      id: "churn",
      type: "customer",
      severity: "warning",
      title: t("ai.insights.churn.title", { count: String(atRisk.length) }),
      description: t("ai.insights.churn.description", {
        count: String(atRisk.length),
        daysStart: String(atRisk[0].daysInactive),
        daysEnd: String(atRisk[atRisk.length - 1].daysInactive),
      }),
      recommendation: t("ai.insights.churn.recommendation"),
      metric: { label: ml("atRiskCustomers"), value: String(atRisk.length) },
    });
  }

  // 12. Anomaly detection on daily revenue
  const revenues = series.map((p) => p.revenue).filter((v) => v > 0);
  if (revenues.length >= 7) {
    const mean = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const variance = revenues.reduce((a, b) => a + (b - mean) ** 2, 0) / revenues.length;
    const std = Math.sqrt(variance) || 1;
    const dips = series.filter((p) => p.revenue > 0 && p.revenue < mean - 1.5 * std).sort((a, b) => a.revenue - b.revenue).slice(0, 2);
    if (dips.length >= 1) {
      insights.push({
        id: "anomaly",
        type: "anomaly",
        severity: "info",
        title: t("ai.insights.anomaly.title"),
        description: t("ai.insights.anomaly.description", { dates: dips.map((d) => d.label).join(", "), avg: fmt(mean) }),
        recommendation: t("ai.insights.anomaly.recommendation"),
      });
    }
  }

  // 13. Health score
  insights.push({
    id: "health",
    type: "health",
    severity: health.score >= 65 ? "success" : health.score >= 50 ? "info" : "warning",
    title: t("ai.insights.health.title", { label: healthLabel, score: String(health.score) }),
    description:
      health.score >= 65 ? t("ai.insights.health.descriptionGood") : t("ai.insights.health.descriptionWarn"),
    metric: { label: ml("healthScore"), value: `${health.score}/100` },
  });

  return insights.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

function severityRank(s: Insight["severity"]): number {
  return s === "critical" ? 0 : s === "warning" ? 1 : s === "info" ? 2 : 3;
}

export { round2 };
