import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { sale, saleItem, product as productTable, customer as customerTable, branch as branchTable } from "@/lib/drizzle/schema";
import { addDays, clamp, endOfDay, round2, safeParseFloat, safeParseInt, startOfDay } from "@/lib/utils";
import { getPeriodTotals, getCustomerStats, rangeToBounds } from "@/server/analytics";
import type { PeriodTotals } from "@/server/analytics";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type StockLevel = "OK" | "LOW" | "OUT";

export interface ProductIntelligence {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  costPrice: number;
  sellingPrice: number;
  stockQty: number;
  lowStockThreshold: number;
  level: StockLevel;
  qtySold: number;
  revenue: number;
  profit: number;
  daysInWindow: number;
  avgDailySales: number;
  daysRemaining: number | null;
  recentTrend: number | null; // % change, second half vs first half
  isFastMover: boolean;
  isOverstock: boolean;
}

export interface RestockRecommendation {
  productId: string;
  name: string;
  category: string | null;
  currentStock: number;
  avgDailySales: number;
  estimatedDaysRemaining: number | null;
  recentTrend: number | null;
  reason: "low-stock" | "stockout-risk" | "below-threshold";
}

export interface InventoryIntelligence {
  totalSkus: number;
  totalUnits: number;
  stockValue: number; // at cost
  retailValue: number; // at selling price
  lowCount: number;
  criticalCount: number;
  outCount: number;
  overstockCount: number;
  fastMoverCount: number;
  slowMoverCount: number;
  low: ProductIntelligence[];
  critical: ProductIntelligence[];
  out: ProductIntelligence[];
  overstock: ProductIntelligence[];
  fastMovers: ProductIntelligence[];
  slowMovers: ProductIntelligence[];
  restockRecommendations: RestockRecommendation[];
}

export interface CategoryPerformance {
  category: string;
  revenue: number;
  orders: number;
  quantity: number;
}

export interface ProfitSlice {
  productId: string;
  name: string;
  category: string | null;
  qty: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  margin: number;
}

export interface ProfitIntelligence {
  revenue: number;
  costOfGoods: number;
  grossProfit: number;
  grossMargin: number;
  profitGrowth: number | null;
  topProfitProducts: ProfitSlice[];
  lowMarginProducts: ProfitSlice[];
  highSalesLowProfit: ProfitSlice[];
  profitByCategory: Array<{ category: string; revenue: number; profit: number; margin: number }>;
  profitByBranch: Array<{ id: string | null; name: string; revenue: number; profit: number }>;
}

export type CustomerSegment =
  | "NEW"
  | "RETURNING"
  | "LOYAL"
  | "HIGH_VALUE"
  | "AT_RISK"
  | "INACTIVE";

export interface CustomerIntelligence {
  totalCustomers: number;
  segments: Record<CustomerSegment, number>;
  newCustomers: CustomerLite[];
  returningCustomers: CustomerLite[];
  loyalCustomers: CustomerLite[];
  highValueCustomers: CustomerLite[];
  atRiskCustomers: CustomerLite[];
  inactiveCustomers: CustomerLite[];
}

export interface CustomerLite {
  id: string;
  name: string;
  email: string | null;
  totalOrders: number;
  totalSpent: number;
  daysSinceLastPurchase: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (deterministic, testable)
// ─────────────────────────────────────────────────────────────────────────────

export function stockLevel(p: { stockQty: number; lowStockThreshold: number }): StockLevel {
  if (p.stockQty <= 0) return "OUT";
  if (p.stockQty <= p.lowStockThreshold) return "LOW";
  return "OK";
}

export function estimatedDaysRemaining(stockQty: number, avgDailySales: number): number | null {
  if (avgDailySales <= 0) return null;
  return stockQty / avgDailySales;
}

export function recentTrendPct(recentValue: number, baselineValue: number): number | null {
  if (baselineValue <= 0) return null;
  return (recentValue - baselineValue) / baselineValue;
}

/** True when a product sells fast enough to be considered a fast mover (≥ 1 unit/day). */
export function isFastMover(avgDailySales: number): boolean {
  return avgDailySales >= 1;
}

/** True when a product holds 4× its reorder level with slow movement. */
export function isOverstock(p: { stockQty: number; lowStockThreshold: number; avgDailySales: number }): boolean {
  return p.lowStockThreshold > 0 && p.stockQty > 0 && p.stockQty >= p.lowStockThreshold * 4 && p.avgDailySales < 0.2;
}

/**
 * Deterministic health-area scoring (0–100). Every component is fully explained:
 * each sub-score is a clamped normalized ratio of an observed metric to a target.
 * Returns null overall when there is not enough data to score honestly.
 */
export interface HealthAreaInput {
  revenueGrowth: number; // period vs previous
  orderGrowth: number;
  aovGrowth: number;
  margin: number; // gross margin (0–1)
  profitGrowth: number;
  healthyStockShare: number; // 0–1 (products OK / total)
  avgCoverageDays: number | null; // mean estimated days remaining (null → treated as neutral)
  overstockShare: number; // 0–1
  repeatRate: number; // 0–1
  activeCustomerShare: number; // 0–1
  atRiskShare: number; // 0–1 (of active customers)
  refundRate: number; // 0–1 (refunded / total orders)
  cashFlowRatio: number; // cash flow / revenue (can be negative)
  expenseGrowth: number; // expenses period-over-period
  hasEnoughData: boolean;
}

export interface HealthAreas {
  sales: number;
  profit: number;
  inventory: number;
  customers: number;
  operations: number;
  overall: number | null;
  status: "HEALTHY" | "NEEDS_ATTENTION" | "AT_RISK" | "CRITICAL" | "INSUFFICIENT_DATA";
}

const norm = (value: number) => clamp(value, 0, 1);

export function computeHealthAreas(input: HealthAreaInput): HealthAreas {
  if (!input.hasEnoughData) {
    return {
      sales: 0,
      profit: 0,
      inventory: 0,
      customers: 0,
      operations: 0,
      overall: null,
      status: "INSUFFICIENT_DATA",
    };
  }

  // Sales: revenue growth drives 40%, orders 30%, AOV 30%.
  const sales =
    40 * norm((input.revenueGrowth + 0.2) / 0.4) +
    30 * norm((input.orderGrowth + 0.3) / 0.6) +
    30 * norm((input.aovGrowth + 0.1) / 0.2);

  // Profit: margin vs a 20% gross-margin target (50%), profit growth (50%).
  const profit =
    50 * norm(input.margin / 0.2) +
    50 * norm((input.profitGrowth + 0.25) / 0.5);

  // Inventory: healthy share (40%), stock coverage (30%), overstock penalty (30%).
  const coverage = input.avgCoverageDays === null ? 1 : norm(input.avgCoverageDays / 30);
  const inventory = 40 * input.healthyStockShare + 30 * coverage - 30 * input.overstockShare;

  // Customers: repeat rate (40%), active share (30%), retention (30%).
  const retention = norm(1 - input.atRiskShare * 2);
  const customers = 40 * norm(input.repeatRate / 0.4) + 30 * input.activeCustomerShare + 30 * retention;

  // Operations: refund discipline (30%), cash position (40%), cost control (30%).
  const refundScore = input.refundRate <= 0.05 ? 1 : input.refundRate >= 0.15 ? 0 : 1 - (input.refundRate - 0.05) / 0.1;
  const cashScore = input.cashFlowRatio <= -0.1 ? 0 : input.cashFlowRatio >= 0.2 ? 1 : (input.cashFlowRatio + 0.1) / 0.3;
  const costScore = norm((input.revenueGrowth - input.expenseGrowth + 0.15) / 0.3);
  const operations = 30 * refundScore + 40 * cashScore + 30 * costScore;

  const round = (v: number) => round2(clamp(v, 0, 100));
  const s = round(sales);
  const p = round(profit);
  const inv = round(inventory);
  const c = round(customers);
  const o = round(operations);
  const overall = round(s * 0.25 + p * 0.25 + inv * 0.2 + c * 0.2 + o * 0.1);

  const status =
    overall >= 80 ? "HEALTHY" : overall >= 65 ? "NEEDS_ATTENTION" : overall >= 50 ? "AT_RISK" : "CRITICAL";

  return { sales: s, profit: p, inventory: inv, customers: c, operations: o, overall, status };
}

/**
 * Segment a single customer deterministically. Priority order: loyal → high-value →
 * inactive → at-risk → returning → new.
 */
export function classifyCustomerSegment(
  c: { totalOrders: number; totalSpent: number; lastPurchaseAt: Date | null; createdAt: Date | null; loyaltyPoints?: number },
  opts: { inactiveDays?: number; atRiskDays?: number; highValueThreshold?: number; today?: Date },
): CustomerSegment {
  const inactiveDays = opts.inactiveDays ?? 60;
  const atRiskDays = opts.atRiskDays ?? 45;
  const now = (opts.today ?? new Date()).getTime();
  const daysSinceLast = c.lastPurchaseAt ? Math.floor((now - c.lastPurchaseAt.getTime()) / 86_400_000) : null;

  if (c.totalOrders >= 3) return "LOYAL";
  if (c.totalOrders > 0 && c.totalSpent >= (opts.highValueThreshold ?? 0)) return "HIGH_VALUE";
  if (c.totalOrders > 0 && (daysSinceLast === null || daysSinceLast >= inactiveDays)) return "INACTIVE";
  if (c.totalOrders > 0 && daysSinceLast !== null && daysSinceLast >= atRiskDays) return "AT_RISK";
  if (c.totalOrders >= 1) return "RETURNING";
  return "NEW";
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

/** Distinct customers who placed a completed sale within a range. */
export async function getDistinctCustomerCount(companyId: string, from: Date, to: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${sale.customerId})::int` })
    .from(sale)
    .where(and(eq(sale.companyId, companyId), eq(sale.status, "COMPLETED"), gte(sale.date, from), lte(sale.date, to), sql`${sale.customerId} IS NOT NULL`));
  return Number(row?.count ?? 0);
}

/** Per-product sales velocity + profit over the lookback window. */
export async function getProductIntelligence(companyId: string, lookbackDays = 30): Promise<ProductIntelligence[]> {
  const to = endOfDay(new Date());
  const from = startOfDay(addDays(new Date(), -(lookbackDays - 1)));

  const [products, agg, firstHalf, secondHalf] = await Promise.all([
    db.select().from(productTable).where(eq(productTable.companyId, companyId)),
    db
      .select({
        pid: saleItem.productId,
        qty: sql<number>`SUM(${saleItem.qty})`,
        revenue: sql<number>`SUM(${saleItem.total})`,
        profit: sql<number>`SUM((${saleItem.unitPrice} - ${saleItem.costPrice}) * ${saleItem.qty})`,
      })
      .from(saleItem)
      .innerJoin(sale, eq(sale.id, saleItem.saleId))
      .where(and(eq(sale.companyId, companyId), eq(sale.status, "COMPLETED"), gte(sale.date, from), lte(sale.date, to)))
      .groupBy(saleItem.productId),
    db
      .select({ pid: saleItem.productId, qty: sql<number>`SUM(${saleItem.qty})` })
      .from(saleItem)
      .innerJoin(sale, eq(sale.id, saleItem.saleId))
      .where(and(eq(sale.companyId, companyId), eq(sale.status, "COMPLETED"), gte(sale.date, from), lte(sale.date, addDays(from, Math.floor(lookbackDays / 2) - 1))))
      .groupBy(saleItem.productId),
    db
      .select({ pid: saleItem.productId, qty: sql<number>`SUM(${saleItem.qty})` })
      .from(saleItem)
      .innerJoin(sale, eq(sale.id, saleItem.saleId))
      .where(and(eq(sale.companyId, companyId), eq(sale.status, "COMPLETED"), gte(sale.date, addDays(from, Math.floor(lookbackDays / 2))), lte(sale.date, to)))
      .groupBy(saleItem.productId),
  ]);

  const aggMap = new Map(agg.map((r) => [String(r.pid), r]));
  const firstMap = new Map(firstHalf.map((r) => [String(r.pid), safeParseFloat(r.qty)]));
  const secondMap = new Map(secondHalf.map((r) => [String(r.pid), safeParseFloat(r.qty)]));

  const items: ProductIntelligence[] = products
    .map((p) => {
      const row = aggMap.get(p.id);
      const qtySold = safeParseFloat(row?.qty);
      const revenue = round2(safeParseFloat(row?.revenue));
      const profit = round2(safeParseFloat(row?.profit));
      const avgDailySales = round2(qtySold / lookbackDays);
      const daysRemaining = estimatedDaysRemaining(p.stockQty, avgDailySales);
      const trend = recentTrendPct(secondMap.get(p.id) ?? 0, firstMap.get(p.id) ?? 0);
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        costPrice: round2(p.costPrice),
        sellingPrice: round2(p.sellingPrice),
        stockQty: safeParseInt(p.stockQty),
        lowStockThreshold: safeParseInt(p.lowStockThreshold),
        level: stockLevel(p),
        qtySold: safeParseInt(qtySold),
        revenue,
        profit,
        daysInWindow: lookbackDays,
        avgDailySales,
        daysRemaining: daysRemaining === null ? null : round2(daysRemaining),
        recentTrend: trend === null ? null : round2(trend * 100),
        isFastMover: isFastMover(avgDailySales),
        isOverstock: isOverstock({ stockQty: p.stockQty, lowStockThreshold: p.lowStockThreshold, avgDailySales }),
      };
    })
    .sort((a, b) => b.avgDailySales - a.avgDailySales);

  return items;
}

/** Inventory health + ranked restock recommendations. */
export async function getInventoryIntelligence(companyId: string, lookbackDays = 30): Promise<InventoryIntelligence> {
  const items = await getProductIntelligence(companyId, lookbackDays);
  const totalUnits = items.reduce((a, p) => a + p.stockQty, 0);
  const stockValue = round2(items.reduce((a, p) => a + p.stockQty * p.costPrice, 0));
  const retailValue = round2(items.reduce((a, p) => a + p.stockQty * p.sellingPrice, 0));

  const low = items.filter((p) => p.level === "LOW");
  const out = items.filter((p) => p.level === "OUT");
  const critical = [...low, ...out].filter((p) => (p.daysRemaining !== null && p.daysRemaining <= 3) || p.stockQty <= 0);
  const overstock = items.filter((p) => p.isOverstock);
  const fastMovers = items.filter((p) => p.isFastMover);
  const slowMovers = items.filter((p) => !p.isFastMover && p.avgDailySales < 0.2 && p.stockQty > 0);

  // Restock recommendations: everything below threshold or close to stockout, ranked by urgency.
  const recommendations: RestockRecommendation[] = items
    .filter((p) => p.level !== "OK" || (p.daysRemaining !== null && p.daysRemaining <= 10))
    .map((p) => ({
      productId: p.id,
      name: p.name,
      category: p.category,
      currentStock: p.stockQty,
      avgDailySales: p.avgDailySales,
      estimatedDaysRemaining: p.daysRemaining,
      recentTrend: p.recentTrend,
      reason: (p.level === "OUT" ? "low-stock" : p.level === "LOW" ? "below-threshold" : "stockout-risk") as RestockRecommendation["reason"],
    }))
    .sort((a, b) => {
      const ad = a.estimatedDaysRemaining ?? Number.POSITIVE_INFINITY;
      const bd = b.estimatedDaysRemaining ?? Number.POSITIVE_INFINITY;
      return ad - bd;
    })
    .slice(0, 12);

  return {
    totalSkus: items.length,
    totalUnits,
    stockValue,
    retailValue,
    lowCount: low.length,
    criticalCount: critical.length,
    outCount: out.length,
    overstockCount: overstock.length,
    fastMoverCount: fastMovers.length,
    slowMoverCount: slowMovers.length,
    low,
    critical,
    out,
    overstock,
    fastMovers: fastMovers.slice(0, 10),
    slowMovers: slowMovers.slice(0, 10),
    restockRecommendations: recommendations,
  };
}

/** Revenue + profit by category. */
export async function getCategoryPerformance(companyId: string, from: Date, to: Date): Promise<CategoryPerformance[]> {
  const rows = await db
    .select({
      category: productTable.category,
      revenue: sql<number>`SUM(${saleItem.total})`,
      orders: sql<number>`COUNT(DISTINCT ${sale.id})::int`,
      quantity: sql<number>`SUM(${saleItem.qty})`,
    })
    .from(saleItem)
    .innerJoin(sale, eq(sale.id, saleItem.saleId))
    .innerJoin(productTable, eq(productTable.id, saleItem.productId))
    .where(and(eq(sale.companyId, companyId), eq(sale.status, "COMPLETED"), gte(sale.date, from), lte(sale.date, to), sql`${productTable.category} IS NOT NULL`))
    .groupBy(productTable.category)
    .orderBy(desc(sql`SUM(${saleItem.total})`));

  return rows.map((r) => ({
    category: String(r.category ?? "Other"),
    revenue: round2(safeParseFloat(r.revenue)),
    orders: safeParseInt(r.orders),
    quantity: safeParseInt(r.quantity),
  }));
}

/** Profit intelligence for a period (uses gross profit = revenue − cost of goods). */
export async function getProfitIntelligence(companyId: string, from: Date, to: Date, prevFrom?: Date, prevTo?: Date): Promise<ProfitIntelligence> {
  const [cur, prev] = await Promise.all([
    getPeriodTotals(companyId, from, to),
    prevFrom && prevTo ? getPeriodTotals(companyId, prevFrom, prevTo) : Promise.resolve(null),
  ]);

  const slices = await db
    .select({
      productId: productTable.id,
      name: productTable.name,
      category: productTable.category,
      qty: sql<number>`SUM(${saleItem.qty})`,
      revenue: sql<number>`SUM(${saleItem.total})`,
      cost: sql<number>`SUM(${saleItem.costPrice} * ${saleItem.qty})`,
      profit: sql<number>`SUM((${saleItem.unitPrice} - ${saleItem.costPrice}) * ${saleItem.qty})`,
    })
    .from(saleItem)
    .innerJoin(sale, eq(sale.id, saleItem.saleId))
    .innerJoin(productTable, eq(productTable.id, saleItem.productId))
    .where(and(eq(sale.companyId, companyId), eq(sale.status, "COMPLETED"), gte(sale.date, from), lte(sale.date, to)))
    .groupBy(productTable.id)
    .orderBy(desc(sql`SUM((${saleItem.unitPrice} - ${saleItem.costPrice}) * ${saleItem.qty})`));

  const products: ProfitSlice[] = slices.map((r) => {
    const revenue = safeParseFloat(r.revenue);
    const grossProfit = safeParseFloat(r.profit);
    return {
      productId: String(r.productId),
      name: String(r.name),
      category: r.category ? String(r.category) : null,
      qty: safeParseInt(r.qty),
      revenue: round2(revenue),
      cost: round2(safeParseFloat(r.cost)),
      grossProfit: round2(grossProfit),
      margin: revenue > 0 ? grossProfit / revenue : 0,
    };
  });

  const revenue = cur.revenue;
  const costOfGoods = round2(revenue - cur.grossProfit);
  const grossProfit = cur.grossProfit;
  const grossMargin = revenue > 0 ? grossProfit / revenue : 0;
  const profitGrowth = prev && prev.grossProfit !== 0 ? (grossProfit - prev.grossProfit) / Math.abs(prev.grossProfit) : cur.grossProfit !== 0 ? 1 : 0;

  // High sales / low profit: among the top half of products by revenue, those below a 15% margin.
  const byRevenue = [...products].sort((a, b) => b.revenue - a.revenue);
  const highSalesCutoff = Math.max(1, Math.ceil(products.length / 2));
  const highSales = byRevenue.slice(0, highSalesCutoff);
  const highSalesLowProfit = highSales.filter((p) => p.margin < 0.15 && p.revenue > 0).slice(0, 8);

  const lowMarginProducts = products.filter((p) => p.margin < 0.15 && p.revenue > 0).sort((a, b) => a.margin - b.margin).slice(0, 8);

  // Profit by category
  const catAgg = new Map<string, { revenue: number; profit: number }>();
  for (const p of products) {
    const key = p.category ?? "Uncategorized";
    const cur = catAgg.get(key) ?? { revenue: 0, profit: 0 };
    cur.revenue += p.revenue;
    cur.profit += p.grossProfit;
    catAgg.set(key, cur);
  }
  const profitByCategory = Array.from(catAgg.entries())
    .map(([category, v]) => ({ category, revenue: round2(v.revenue), profit: round2(v.profit), margin: v.revenue > 0 ? v.profit / v.revenue : 0 }))
    .sort((a, b) => b.profit - a.profit);

  // Profit by branch
  const branchRows = await db
    .select({
      id: branchTable.id,
      name: branchTable.name,
      revenue: sql<number>`SUM(${sale.total})`,
      profit: sql<number>`COALESCE(SUM((${saleItem.unitPrice} - ${saleItem.costPrice}) * ${saleItem.qty}), 0)`,
    })
    .from(sale)
    .leftJoin(branchTable, eq(sale.branchId, branchTable.id))
    .leftJoin(saleItem, eq(saleItem.saleId, sale.id))
    .where(and(eq(sale.companyId, companyId), eq(sale.status, "COMPLETED"), gte(sale.date, from), lte(sale.date, to)))
    .groupBy(branchTable.id, branchTable.name)
    .orderBy(desc(sql`SUM(${sale.total})`));
  const profitByBranch = branchRows.map((b) => ({
    id: b.id ? String(b.id) : null,
    name: b.name ? String(b.name) : "Unassigned",
    revenue: round2(safeParseFloat(b.revenue)),
    profit: round2(safeParseFloat(b.profit)),
  }));

  return {
    revenue: round2(revenue),
    costOfGoods,
    grossProfit: round2(grossProfit),
    grossMargin,
    profitGrowth: round2(profitGrowth),
    topProfitProducts: products.slice(0, 8),
    lowMarginProducts,
    highSalesLowProfit,
    profitByCategory,
    profitByBranch,
  };
}

/** Customer intelligence: segment counts + representative lists. */
export async function getCustomerIntelligence(
  companyId: string,
  opts: { inactiveDays?: number; atRiskDays?: number; highValueThreshold?: number; today?: Date; limit?: number } = {},
): Promise<CustomerIntelligence> {
  const limit = opts.limit ?? 10;
  const today = opts.today ?? new Date();
  const customers = await db
    .select({
      id: customerTable.id,
      name: customerTable.name,
      email: customerTable.email,
      totalOrders: customerTable.totalOrders,
      totalSpent: customerTable.totalSpent,
      lastPurchaseAt: customerTable.lastPurchaseAt,
      createdAt: customerTable.createdAt,
    })
    .from(customerTable)
    .where(eq(customerTable.companyId, companyId));

  const now = today.getTime();
  const daysSince = (d: Date | null) => (d ? Math.floor((now - d.getTime()) / 86_400_000) : null);

  const lite = (c: (typeof customers)[number]): CustomerLite => ({
    id: c.id,
    name: c.name,
    email: c.email,
    totalOrders: safeParseInt(c.totalOrders),
    totalSpent: round2(safeParseFloat(c.totalSpent)),
    daysSinceLastPurchase: daysSince(c.lastPurchaseAt),
  });

  const spend = customers.map((c) => safeParseFloat(c.totalSpent)).sort((a, b) => b - a);
  const threshold = opts.highValueThreshold ?? (spend.length >= 5 ? spend[Math.min(Math.floor(spend.length * 0.2), spend.length - 1)] : 1000);

  const segments: Record<CustomerSegment, CustomerLite[]> = {
    NEW: [],
    RETURNING: [],
    LOYAL: [],
    HIGH_VALUE: [],
    AT_RISK: [],
    INACTIVE: [],
  };

  for (const c of customers) {
    const seg = classifyCustomerSegment(c, { inactiveDays: opts.inactiveDays, atRiskDays: opts.atRiskDays, highValueThreshold: threshold, today });
    segments[seg].push(lite(c));
  }

  const sortBySpent = (arr: CustomerLite[]) => arr.sort((a, b) => b.totalSpent - a.totalSpent);

  const counts = (Object.keys(segments) as CustomerSegment[]).reduce<Record<CustomerSegment, number>>((acc, k) => {
    acc[k] = segments[k].length;
    return acc;
  }, { NEW: 0, RETURNING: 0, LOYAL: 0, HIGH_VALUE: 0, AT_RISK: 0, INACTIVE: 0 });

  return {
    totalCustomers: customers.length,
    segments: counts,
    newCustomers: sortBySpent(segments.NEW).slice(0, limit),
    returningCustomers: sortBySpent(segments.RETURNING).slice(0, limit),
    loyalCustomers: sortBySpent(segments.LOYAL).slice(0, limit),
    highValueCustomers: sortBySpent(segments.HIGH_VALUE).slice(0, limit),
    atRiskCustomers: sortBySpent(segments.AT_RISK).slice(0, limit),
    inactiveCustomers: sortBySpent(segments.INACTIVE).slice(0, limit),
  };
}

/** AOV / orders / customers per category helper reused by the today brief. */
export async function getTodayCategoryDeltas(
  companyId: string,
  today: Date,
  lookbackAvgFrom: Date,
  lookbackAvgTo: Date,
): Promise<Array<{ category: string; todayRevenue: number; avgRevenue: number; deltaPct: number | null }>> {
  const todayFrom = startOfDay(today);
  const todayTo = endOfDay(today);
  const [todayCats, avgCats] = await Promise.all([
    getCategoryPerformance(companyId, todayFrom, todayTo),
    getCategoryPerformance(companyId, lookbackAvgFrom, lookbackAvgTo),
  ]);
  const windowDays = Math.max(1, Math.round((lookbackAvgTo.getTime() - lookbackAvgFrom.getTime()) / 86_400_000) + 1);
  const avgMap = new Map(avgCats.map((c) => [c.category, c.revenue / windowDays]));
  return todayCats
    .map((c) => {
      const avgDaily = avgMap.get(c.category) ?? 0;
      const delta = avgDaily > 0 ? (c.revenue - avgDaily) / avgDaily : null;
      return { category: c.category, todayRevenue: c.revenue, avgRevenue: round2(avgDaily), deltaPct: delta === null ? null : round2(delta * 100) };
    })
    .sort((a, b) => (b.deltaPct ?? -1) - (a.deltaPct ?? -1));
}

export { getPeriodTotals, getCustomerStats, rangeToBounds };