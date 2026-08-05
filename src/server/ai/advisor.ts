import type { Locale } from "@/lib/i18n";
import { serverT } from "@/lib/i18n/server";
import { formatCurrency } from "@/lib/utils";
import type { DateRange } from "@/lib/validators";
import {
  computeHealthScore,
  getAtRiskCustomers,
  getCustomerStats,
  getExpenseByCategory,
  getPeriodTotals,
  getStockStatus,
  getTopBranches,
  getTopEmployees,
  getTopProducts,
  rangeToBounds,
} from "@/server/analytics";
import type { InsightSeverity } from "@/server/ai/types";

export interface AdvisorAnswer {
  answer: string;
  bullets: string[];
  tone: InsightSeverity;
}

type Intent =
  | "revenue"
  | "profit"
  | "expenses"
  | "stock"
  | "health"
  | "top"
  | "customers"
  | "growth"
  | "employees"
  | "branches"
  | "fallback";

const INTENT_PATTERNS: Record<Exclude<Intent, "fallback">, RegExp[]> = {
  revenue: [/revenue/i, /\bsales\b/i, /income/i, /\bearn/i, /\bgross/i, /إيراد|ايراد|مبيعات|دخل|المبيعات/],
  profit: [/profit/i, /margin/i, /ربح|الربح|هامش|الهامش/],
  expenses: [/expense/i, /\bcost/i, /\bspend/i, /مصروف|مصاريف|تكلف|نفقات/],
  stock: [/stock/i, /inventory/i, /reorder/i, /low.?stock/i, /مخزون|نفاد|تخزين/],
  health: [/health/i, /\bscore\b/i, /healthy/i, /صحة|الصحة|صحي/],
  top: [/best.?sell/i, /top product/i, /best product/i, /most.?sell/i, /مبيع|الأفضل|الأكثر|المنتج الأكثر/],
  customers: [/customer/i, /client/i, /churn/i, /عملاء|العميل|الزبائن/],
  growth: [/grow/i, /trend/i, /increase/i, /decline/i, /drop/i, /نمو|اتجاه|تراجع|انخفاض/],
  employees: [/employee/i, /\bstaff\b/i, /\bseller\b/i, /\bteam\b/i, /performance/i, /موظف|فريق|بائع|أداء/],
  branches: [/\bbranch/i, /location/i, /\bstore/i, /فرع|فروع|متجر/],
};

function matchIntent(question: string): Intent {
  const q = question.toLocaleLowerCase("ar");
  for (const intent of Object.keys(INTENT_PATTERNS) as Exclude<Intent, "fallback">[]) {
    if (INTENT_PATTERNS[intent].some((re) => re.test(q))) return intent;
  }
  return "fallback";
}

/**
 * Deterministic, fully localized AI Advisor.
 *
 * Analyzes real data per question intent and returns a natural-language
 * answer in the user's locale (en/ar). Runs locally for free; swap for an
 * LLM provider later through the pluggable AI layer without UI changes.
 */
export async function answerQuestion(
  companyId: string,
  range: DateRange,
  currency: string,
  locale: Locale,
  question: string,
): Promise<AdvisorAnswer> {
  const t = serverT(locale);
  const { from, to, prevFrom, prevTo } = rangeToBounds(range);
  const [cur, prev, products, branches, employees, expenses, prevExpenses, stock, atRisk, customerStats] = await Promise.all([
    getPeriodTotals(companyId, from, to),
    getPeriodTotals(companyId, prevFrom, prevTo),
    getTopProducts(companyId, from, to, 5),
    getTopBranches(companyId, from, to, 5),
    getTopEmployees(companyId, from, to, 5),
    getExpenseByCategory(companyId, from, to),
    getExpenseByCategory(companyId, prevFrom, prevTo),
    getStockStatus(companyId),
    getAtRiskCustomers(companyId, 45, 5),
    getCustomerStats(companyId, from, to),
  ]);

  const fmt = (v: number) => formatCurrency(v, currency);
  const pct = (a: number, b: number) => (b !== 0 ? ((a - b) / Math.abs(b)) * 100 : a !== 0 ? 100 : 0);
  const growth = pct(cur.revenue, prev.revenue);
  const aov = cur.orders > 0 ? cur.revenue / cur.orders : 0;
  const health = computeHealthScore(cur, prev, customerStats);

  const intent = matchIntent(question);

  const empty = (): AdvisorAnswer => ({ answer: t("advisor.errors.generic"), bullets: [], tone: "info" });

  switch (intent) {
    case "revenue": {
      const key = growth > 5 ? "revenueUp" : growth < -5 ? "revenueDown" : "revenueFlat";
      const direction = growth > 0 ? "+" : "";
      const answer = t(`advisor.answers.${key}`, {
        revenue: fmt(cur.revenue),
        growth: `${direction}${growth.toFixed(1)}`,
        orders: String(cur.orders),
        aov: fmt(aov),
      });
      const bullets = [t("dashboard.kpis.revenue"), t("dashboard.kpis.orders"), t("dashboard.kpis.avgOrderValue")].filter(
        (b, i, arr) => arr.indexOf(b) === i,
      );
      return { answer, bullets, tone: growth < -5 ? "warning" : growth > 5 ? "success" : "info" };
    }
    case "profit": {
      const margin = cur.revenue > 0 ? (cur.netProfit / cur.revenue) * 100 : 0;
      const advice =
        cur.netProfit < 0 ? t("advisor.answers.profitNegative") : cur.margin < 0.05 ? t("advisor.answers.profitRisk") : t("advisor.answers.profitAdvice");
      const answer = `${t("advisor.answers.profit", { profit: fmt(cur.netProfit), revenue: fmt(cur.revenue), margin: `${margin.toFixed(1)}%` })} ${advice}`;
      return { answer, bullets: [], tone: cur.netProfit < 0 ? "critical" : cur.margin < 0.05 ? "warning" : "success" };
    }
    case "expenses": {
      const top = expenses.slice(0, 3).map((e) => e.category).join(", ") || "—";
      let answer = t("advisor.answers.expenses", { expenses: fmt(cur.expenses), top });
      const prevByCat = prevExpenses.reduce<Record<string, number>>((acc, e) => {
        acc[e.category] = e.amount;
        return acc;
      }, {});
      const spike = expenses.find((e) => (prevByCat[e.category] ?? 0) > 0 && e.amount > prevByCat[e.category] * 1.25);
      if (spike) {
        answer += ` ${t("advisor.answers.expensesSpike", { category: spike.category, amount: fmt(spike.amount) })}`;
      }
      return { answer, bullets: [], tone: spike ? "warning" : "info" };
    }
    case "stock": {
      if (stock.low.length === 0) {
        return { answer: t("advisor.answers.stockOk"), bullets: [], tone: "success" };
      }
      const names = stock.low.slice(0, 4).map((p) => p.name).join(", ");
      const answer = t("advisor.answers.stockLow", { count: String(stock.low.length), names });
      return { answer, bullets: [], tone: "warning" };
    }
    case "health": {
      const advice = health.score >= 65 ? t("advisor.answers.healthGood") : t("advisor.answers.healthNeedsWork");
      const answer = t("advisor.answers.health", { score: String(health.score), label: health.label, advice });
      return { answer, bullets: [], tone: health.score >= 65 ? "success" : health.score >= 50 ? "info" : "warning" };
    }
    case "top": {
      if (products.length === 0) {
        return { answer: t("advisor.errors.generic"), bullets: [], tone: "info" };
      }
      const top = products[0];
      const answer = t("advisor.answers.top", { name: top.name, qty: String(top.qty), profit: fmt(top.profit) });
      const bullets = products.slice(1).map((p) => `${p.name} — ${fmt(p.revenue)}`);
      return { answer, bullets, tone: "success" };
    }
    case "customers": {
      const answer = t("advisor.answers.customers", {
        count: String(customerStats.activeCustomers),
        repeat: customerStats.repeatRate.toFixed(0),
        atRisk: String(atRisk.length),
      });
      return { answer, bullets: [], tone: atRisk.length >= 2 ? "warning" : "info" };
    }
    case "growth": {
      const key = growth > 0 ? "growthUp" : "growthDown";
      const answer = t(`advisor.answers.${key}`, { growth: `${growth > 0 ? "+" : ""}${growth.toFixed(1)}` });
      return { answer, bullets: [], tone: growth > 0 ? "success" : "warning" };
    }
    case "employees": {
      if (employees.length === 0 || !employees[0].id) {
        return { answer: t("advisor.errors.generic"), bullets: [], tone: "info" };
      }
      const best = employees[0];
      const answer = t("advisor.answers.employees", { name: best.name, orders: String(best.orders), revenue: fmt(best.revenue) });
      const bullets = employees.slice(1, 4).map((e) => `${e.name} — ${e.orders} ${t("dashboard.kpis.orders").toLocaleLowerCase(locale)}`);
      return { answer, bullets, tone: "info" };
    }
    case "branches": {
      if (branches.length === 0) {
        return { answer: t("advisor.errors.generic"), bullets: [], tone: "info" };
      }
      const best = branches[0];
      const worst = branches[branches.length - 1];
      const answer = t("advisor.answers.branches", {
        best: best.name,
        revenue: fmt(best.revenue),
        worst: worst && worst.name !== best.name ? worst.name : best.name,
      });
      return { answer, bullets: [], tone: "info" };
    }
    default: {
      const answer = t("advisor.answers.fallback", {
        revenue: fmt(cur.revenue),
        profit: fmt(cur.netProfit),
        score: String(health.score),
      });
      const bullets = [
        t("advisor.answers.stockLow", { count: String(stock.low.length), names: stock.low.slice(0, 2).map((p) => p.name).join(", ") || "-" }),
        t("advisor.answers.health", { score: String(health.score), label: health.label, advice: "" }).trim(),
      ];
      return { answer, bullets, tone: health.score >= 65 ? "success" : "warning" };
    }
  }
}

export async function advisorPrefetch(companyId: string, range: DateRange, currency: string, locale: Locale): Promise<AdvisorAnswer> {
  return answerQuestion(companyId, range, currency, locale, "overview");
}
