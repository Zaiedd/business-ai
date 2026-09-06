import { eq, and, desc, asc, sql, gte, lte, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { sale, saleItem, product as productTable, expense as expenseTable, customer as customerTable, branch as branchTable, user as userTable } from "@/lib/drizzle/schema";
import { addDays, clamp, dayKey, endOfDay, formatShortDate, round2, safeParseFloat, safeParseInt, startOfDay } from "@/lib/utils";
import type { DateRange } from "@/lib/validators";

export interface PeriodTotals {
  revenue: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
  cashFlow: number;
  orders: number;
  avgOrderValue: number;
  margin: number;
  itemsSold: number;
}

export interface DailyPoint {
  date: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface ProductPerformance {
  id: string;
  name: string;
  category: string | null;
  qty: number;
  revenue: number;
  profit: number;
}

export interface BranchPerformance {
  id: string | null;
  name: string;
  orders: number;
  revenue: number;
}

export interface EmployeePerformance {
  id: string | null;
  name: string;
  orders: number;
  revenue: number;
}

export interface ExpenseSlice {
  category: string;
  amount: number;
}

export interface AtRiskCustomer {
  id: string;
  name: string;
  email: string | null;
  totalOrders: number;
  totalSpent: number;
  lastPurchaseAt: Date | null;
  daysInactive: number;
}

export function rangeToBounds(range: DateRange): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
  const to = endOfDay(new Date());
  const from = startOfDay(addDays(new Date(), -(days - 1)));
  const prevTo = endOfDay(addDays(from, -1));
  const prevFrom = startOfDay(addDays(from, -days));
  return { from, to, prevFrom, prevTo };
}

export async function getPeriodTotals(companyId: string, from: Date, to: Date): Promise<PeriodTotals> {
  const [saleRow] = await db
    .select({
      orders: sql<number>`COUNT(*)::int`,
      revenue: sql<number>`COALESCE(SUM(${sale.total}), 0)`,
    })
    .from(sale)
    .where(and(eq(sale.companyId, companyId), gte(sale.date, from), lte(sale.date, to), eq(sale.status, "COMPLETED")));

  const [expenseRow] = await db
    .select({ amount: sql<number>`COALESCE(SUM(${expenseTable.amount}), 0)` })
    .from(expenseTable)
    .where(and(eq(expenseTable.companyId, companyId), gte(expenseTable.date, from), lte(expenseTable.date, to)));

  const [grossRow] = await db
    .select({ gross: sql<number>`COALESCE(SUM((${saleItem.unitPrice} - ${saleItem.costPrice}) * ${saleItem.qty}), 0)` })
    .from(saleItem)
    .innerJoin(sale, eq(sale.id, saleItem.saleId))
    .where(and(eq(sale.companyId, companyId), gte(sale.date, from), lte(sale.date, to), eq(sale.status, "COMPLETED")));

  const [itemsRow] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${saleItem.qty}), 0)` })
    .from(saleItem)
    .innerJoin(sale, eq(sale.id, saleItem.saleId))
    .where(and(eq(sale.companyId, companyId), gte(sale.date, from), lte(sale.date, to), eq(sale.status, "COMPLETED")));

  const revenue = round2(Number(saleRow?.revenue ?? 0));
  const expenses = round2(Number(expenseRow?.amount ?? 0));
  const grossProfit = round2(Number(grossRow?.gross ?? 0));
  const orders = Number(saleRow?.orders ?? 0);
  const itemsSold = Number(itemsRow?.qty ?? 0);
  const netProfit = round2(grossProfit - expenses);
  const cashFlow = round2(revenue - expenses);
  const avgOrderValue = orders > 0 ? round2(revenue / orders) : 0;
  const margin = revenue > 0 ? netProfit / revenue : 0;

  return { revenue, expenses, grossProfit, netProfit, cashFlow, orders, avgOrderValue, margin, itemsSold };
}

export async function getDailySeries(companyId: string, from: Date, to: Date): Promise<DailyPoint[]> {
  const [sales, expenses] = await Promise.all([
    db
      .select({ date: sale.date, total: sale.total })
      .from(sale)
      .where(and(eq(sale.companyId, companyId), eq(sale.status, "COMPLETED"), gte(sale.date, from), lte(sale.date, to))),
    db
      .select({ date: expenseTable.date, amount: expenseTable.amount })
      .from(expenseTable)
      .where(and(eq(expenseTable.companyId, companyId), gte(expenseTable.date, from), lte(expenseTable.date, to))),
  ]);

  const byDay = new Map<string, DailyPoint>();
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) {
    const key = dayKey(d);
    byDay.set(key, { date: key, label: formatShortDate(d), revenue: 0, expenses: 0, profit: 0 });
  }

  for (const s of sales) {
    const point = byDay.get(dayKey(s.date));
    if (point) point.revenue = round2(point.revenue + s.total);
  }
  for (const e of expenses) {
    const point = byDay.get(dayKey(e.date));
    if (point) point.expenses = round2(point.expenses + e.amount);
  }
  for (const point of byDay.values()) {
    point.profit = round2(point.revenue - point.expenses);
  }
  return Array.from(byDay.values());
}

export async function getTopProducts(companyId: string, from: Date, to: Date, limit = 6): Promise<ProductPerformance[]> {
  const rows = await db
    .select({
      pid: productTable.id,
      name: productTable.name,
      category: productTable.category,
      qty: sql<number>`SUM(${saleItem.qty})`,
      revenue: sql<number>`SUM(${saleItem.total})`,
      profit: sql<number>`SUM((${saleItem.unitPrice} - ${saleItem.costPrice}) * ${saleItem.qty})`,
    })
    .from(saleItem)
    .innerJoin(sale, eq(sale.id, saleItem.saleId))
    .innerJoin(productTable, eq(productTable.id, saleItem.productId))
    .where(and(eq(sale.companyId, companyId), gte(sale.date, from), lte(sale.date, to), eq(sale.status, "COMPLETED")))
    .groupBy(productTable.id)
    .orderBy(desc(sql`SUM((${saleItem.unitPrice} - ${saleItem.costPrice}) * ${saleItem.qty})`))
    .limit(limit);

  return rows.map((r) => ({
    id: String(r.pid ?? ""),
    name: String(r.name ?? "Unknown"),
    category: r.category ? String(r.category) : null,
    qty: safeParseInt(r.qty),
    revenue: round2(safeParseFloat(r.revenue)),
    profit: round2(safeParseFloat(r.profit)),
  }));
}

export async function getTopBranches(companyId: string, from: Date, to: Date, limit = 6): Promise<BranchPerformance[]> {
  const rows = await db
    .select({
      id: branchTable.id,
      name: branchTable.name,
      orders: sql<number>`COUNT(${sale.id})`,
      revenue: sql<number>`COALESCE(SUM(${sale.total}), 0)`,
    })
    .from(sale)
    .leftJoin(branchTable, eq(branchTable.id, sale.branchId))
    .where(and(eq(sale.companyId, companyId), gte(sale.date, from), lte(sale.date, to), eq(sale.status, "COMPLETED")))
    .groupBy(branchTable.id, branchTable.name)
    .orderBy(desc(sql`SUM(${sale.total})`))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id ? String(r.id) : null,
    name: r.name ? String(r.name) : "Unassigned",
    orders: safeParseInt(r.orders),
    revenue: round2(safeParseFloat(r.revenue)),
  }));
}

export async function getTopEmployees(companyId: string, from: Date, to: Date, limit = 6): Promise<EmployeePerformance[]> {
  const rows = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      orders: sql<number>`COUNT(${sale.id})`,
      revenue: sql<number>`COALESCE(SUM(${sale.total}), 0)`,
    })
    .from(sale)
    .leftJoin(userTable, eq(userTable.id, sale.userId))
    .where(and(eq(sale.companyId, companyId), gte(sale.date, from), lte(sale.date, to), eq(sale.status, "COMPLETED")))
    .groupBy(userTable.id, userTable.name)
    .orderBy(desc(sql`SUM(${sale.total})`))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id ? String(r.id) : null,
    name: r.name ? String(r.name) : "Unassigned",
    orders: safeParseInt(r.orders),
    revenue: round2(safeParseFloat(r.revenue)),
  }));
}

export async function getExpenseByCategory(companyId: string, from: Date, to: Date): Promise<ExpenseSlice[]> {
  const rows = await db
    .select({
      category: expenseTable.category,
      amount: sql<number>`COALESCE(SUM(${expenseTable.amount}), 0)`,
    })
    .from(expenseTable)
    .where(and(eq(expenseTable.companyId, companyId), gte(expenseTable.date, from), lte(expenseTable.date, to)))
    .groupBy(expenseTable.category)
    .orderBy(desc(sql`SUM(${expenseTable.amount})`));

  return rows.map((r) => ({
    category: String(r.category ?? "Other"),
    amount: round2(safeParseFloat(r.amount)),
  }));
}

export async function getStockStatus(companyId: string, limit = 8) {
  const products = await db
    .select({
      id: productTable.id,
      name: productTable.name,
      sku: productTable.sku,
      category: productTable.category,
      stockQty: productTable.stockQty,
      lowStockThreshold: productTable.lowStockThreshold,
      sellingPrice: productTable.sellingPrice,
      costPrice: productTable.costPrice,
    })
    .from(productTable)
    .where(eq(productTable.companyId, companyId))
    .orderBy(productTable.stockQty)
    .limit(200);

  const low = products.filter((p) => p.stockQty <= p.lowStockThreshold);
  const out = products.filter((p) => p.stockQty <= 0);
  const top = products
    .filter((p) => p.stockQty > p.lowStockThreshold)
    .sort((a, b) => b.stockQty - a.stockQty)
    .slice(0, limit);
  return { low, out, top };
}

export async function getAtRiskCustomers(companyId: string, inactiveDays = 45, limit = 8): Promise<AtRiskCustomer[]> {
  const customers = await db
    .select({
      id: customerTable.id,
      name: customerTable.name,
      email: customerTable.email,
      totalOrders: customerTable.totalOrders,
      totalSpent: customerTable.totalSpent,
      lastPurchaseAt: customerTable.lastPurchaseAt,
    })
    .from(customerTable)
    .where(and(eq(customerTable.companyId, companyId), gte(customerTable.totalOrders, 1)))
    .orderBy(customerTable.lastPurchaseAt)
    .limit(200);

  const now = Date.now();
  return customers
    .map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      totalOrders: c.totalOrders,
      totalSpent: c.totalSpent,
      lastPurchaseAt: c.lastPurchaseAt,
      daysInactive: Math.floor((now - (c.lastPurchaseAt?.getTime() ?? now)) / 86_400_000),
    }))
    .filter((c) => c.daysInactive >= inactiveDays)
    .slice(0, limit);
}

export async function getCustomerStats(companyId: string, from: Date, to: Date) {
  const [totalRow] = await db
    .select({ total: count() })
    .from(customerTable)
    .where(eq(customerTable.companyId, companyId));

  const [activeRow] = await db
    .select({ active: sql<number>`COUNT(DISTINCT ${sale.customerId})::int` })
    .from(sale)
    .where(and(eq(sale.companyId, companyId), gte(sale.date, from), lte(sale.date, to), sql`${sale.customerId} IS NOT NULL`));

  const [repeatRow] = await db
    .select({ c: sql<number>`COUNT(*)::int` })
    .from(
      db
        .select({ customerId: sale.customerId })
        .from(sale)
        .where(and(eq(sale.companyId, companyId), gte(sale.date, from), lte(sale.date, to), sql`${sale.customerId} IS NOT NULL`))
        .groupBy(sale.customerId)
        .having(sql`COUNT(*) > 1`)
        .as("repeatSub")
    );

  const total = Number(totalRow?.total ?? 0);
  const active = Number(activeRow?.active ?? 0);
  const repeat = Number(repeatRow?.c ?? 0);
  return {
    totalCustomers: total,
    activeCustomers: active,
    repeatRate: active > 0 ? repeat / active : 0,
  };
}

export async function getRecentSales(companyId: string, limit = 8) {
  return db
    .select({
      id: sale.id,
      invoiceNo: sale.invoiceNo,
      date: sale.date,
      total: sale.total,
      status: sale.status,
      branch: { name: branchTable.name },
      customer: { name: customerTable.name },
      user: { name: userTable.name },
    })
    .from(sale)
    .leftJoin(branchTable, eq(sale.branchId, branchTable.id))
    .leftJoin(customerTable, eq(sale.customerId, customerTable.id))
    .leftJoin(userTable, eq(sale.userId, userTable.id))
    .where(eq(sale.companyId, companyId))
    .orderBy(desc(sale.date))
    .limit(limit);
}

// Composite business-health score (0-100), deterministic.
export function computeHealthScore(totals: PeriodTotals, prev: PeriodTotals, customerStats: { repeatRate: number }): { score: number; label: string } {
  const revGrowth = prev.revenue > 0 ? (totals.revenue - prev.revenue) / prev.revenue : 0;
  const orderGrowth = prev.orders > 0 ? (totals.orders - prev.orders) / prev.orders : 0;
  const cashRatio = totals.revenue > 0 ? totals.cashFlow / totals.revenue : 0;

  const profitability = 30 * clamp(totals.margin / 0.15, 0, 1);
  const growth = 25 * clamp(revGrowth / 0.2, 0, 1);
  const liquidity = 20 * clamp((cashRatio + 0.2) / 0.4, 0, 1);
  const activity = 15 * clamp(orderGrowth / 0.3, 0, 1);
  const customers = 10 * clamp(customerStats.repeatRate / 0.4, 0, 1);

  const score = Math.round(profitability + growth + liquidity + activity + customers);
  const label = score >= 80 ? "Excellent" : score >= 65 ? "Good" : score >= 50 ? "Fair" : "At risk";
  return { score: clamp(score, 0, 100), label };
}

// Simple least-squares linear regression forecast on a daily series.
export function linearForecast(points: Array<{ x: number; y: number }>, horizon: number): { slope: number; intercept: number; next: number[] } {
  const n = points.length;
  if (n < 3) return { slope: 0, intercept: 0, next: [] };
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;
  const next = Array.from({ length: horizon }, (_, i) => Math.max(0, slope * (n - 1 + i + 1) + intercept));
  return { slope, intercept, next };
}
