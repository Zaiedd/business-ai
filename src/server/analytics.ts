import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
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
  const [saleRow, expenseRow, grossRow, itemsRow] = await Promise.all([
    prisma.$queryRaw<Array<{ orders: bigint | number; revenue: number }>>(Prisma.sql`
      SELECT COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue
      FROM Sale WHERE companyId = ${companyId} AND date BETWEEN ${from} AND ${to} AND status = 'COMPLETED'`),
    prisma.$queryRaw<Array<{ amount: number }>>(Prisma.sql`
      SELECT COALESCE(SUM(amount), 0) as amount
      FROM Expense WHERE companyId = ${companyId} AND date BETWEEN ${from} AND ${to}`),
    prisma.$queryRaw<Array<{ gross: number }>>(Prisma.sql`
      SELECT COALESCE(SUM((i.unitPrice - i.costPrice) * i.qty), 0) as gross
      FROM SaleItem i JOIN Sale s ON s.id = i.saleId
      WHERE s.companyId = ${companyId} AND s.date BETWEEN ${from} AND ${to} AND s.status = 'COMPLETED'`),
    prisma.$queryRaw<Array<{ qty: bigint | number }>>(Prisma.sql`
      SELECT COALESCE(SUM(i.qty), 0) as qty
      FROM SaleItem i JOIN Sale s ON s.id = i.saleId
      WHERE s.companyId = ${companyId} AND s.date BETWEEN ${from} AND ${to} AND s.status = 'COMPLETED'`),
  ]);

  const revenue = round2(safeParseFloat(saleRow[0]?.revenue));
  const expenses = round2(safeParseFloat(expenseRow[0]?.amount));
  const grossProfit = round2(safeParseFloat(grossRow[0]?.gross));
  const orders = safeParseInt(saleRow[0]?.orders);
  const itemsSold = safeParseInt(itemsRow[0]?.qty);
  const netProfit = round2(grossProfit - expenses);
  const cashFlow = round2(revenue - expenses);
  const avgOrderValue = orders > 0 ? round2(revenue / orders) : 0;
  const margin = revenue > 0 ? netProfit / revenue : 0;

  return { revenue, expenses, grossProfit, netProfit, cashFlow, orders, avgOrderValue, margin, itemsSold };
}

export async function getDailySeries(companyId: string, from: Date, to: Date): Promise<DailyPoint[]> {
  const [sales, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: { companyId, status: "COMPLETED", date: { gte: from, lte: to } },
      select: { date: true, total: true },
    }),
    prisma.expense.findMany({
      where: { companyId, date: { gte: from, lte: to } },
      select: { date: true, amount: true },
    }),
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
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT p.id as pid, p.name as name, p.category as category,
      SUM(i.qty) as qty, SUM(i.total) as revenue,
      SUM((i.unitPrice - i.costPrice) * i.qty) as profit
    FROM SaleItem i
    JOIN Sale s ON s.id = i.saleId
    JOIN Product p ON p.id = i.productId
    WHERE s.companyId = ${companyId} AND s.date BETWEEN ${from} AND ${to} AND s.status = 'COMPLETED'
    GROUP BY p.id ORDER BY profit DESC LIMIT ${limit}`);
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
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT b.id as id, b.name as name, COUNT(s.id) as orders, COALESCE(SUM(s.total), 0) as revenue
    FROM Sale s LEFT JOIN Branch b ON b.id = s.branchId
    WHERE s.companyId = ${companyId} AND s.date BETWEEN ${from} AND ${to} AND s.status = 'COMPLETED'
    GROUP BY b.id ORDER BY revenue DESC LIMIT ${limit}`);
  return rows.map((r) => ({
    id: r.id ? String(r.id) : null,
    name: r.name ? String(r.name) : "Unassigned",
    orders: safeParseInt(r.orders),
    revenue: round2(safeParseFloat(r.revenue)),
  }));
}

export async function getTopEmployees(companyId: string, from: Date, to: Date, limit = 6): Promise<EmployeePerformance[]> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT u.id as id, u.name as name, COUNT(s.id) as orders, COALESCE(SUM(s.total), 0) as revenue
    FROM Sale s LEFT JOIN User u ON u.id = s.userId
    WHERE s.companyId = ${companyId} AND s.date BETWEEN ${from} AND ${to} AND s.status = 'COMPLETED'
    GROUP BY u.id ORDER BY revenue DESC LIMIT ${limit}`);
  return rows.map((r) => ({
    id: r.id ? String(r.id) : null,
    name: r.name ? String(r.name) : "Unassigned",
    orders: safeParseInt(r.orders),
    revenue: round2(safeParseFloat(r.revenue)),
  }));
}

export async function getExpenseByCategory(companyId: string, from: Date, to: Date): Promise<ExpenseSlice[]> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT category, COALESCE(SUM(amount), 0) as amount
    FROM Expense WHERE companyId = ${companyId} AND date BETWEEN ${from} AND ${to}
    GROUP BY category ORDER BY amount DESC`);
  return rows.map((r) => ({
    category: String(r.category ?? "Other"),
    amount: round2(safeParseFloat(r.amount)),
  }));
}

export async function getStockStatus(companyId: string, limit = 8) {
  const products = await prisma.product.findMany({
    where: { companyId },
    select: { id: true, name: true, sku: true, category: true, stockQty: true, lowStockThreshold: true, sellingPrice: true, costPrice: true },
    orderBy: { stockQty: "asc" },
    take: 200,
  });
  const low = products.filter((p) => p.stockQty <= p.lowStockThreshold);
  const out = products.filter((p) => p.stockQty <= 0);
  const top = products
    .filter((p) => p.stockQty > p.lowStockThreshold)
    .sort((a, b) => b.stockQty - a.stockQty)
    .slice(0, limit);
  return { low, out, top };
}

export async function getAtRiskCustomers(companyId: string, inactiveDays = 45, limit = 8): Promise<AtRiskCustomer[]> {
  const customers = await prisma.customer.findMany({
    where: { companyId, totalOrders: { gte: 1 } },
    select: { id: true, name: true, email: true, totalOrders: true, totalSpent: true, lastPurchaseAt: true },
    orderBy: { lastPurchaseAt: "asc" },
    take: 200,
  });
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
  const total = await prisma.customer.count({ where: { companyId } });
  const [activeRow, repeatRow] = await Promise.all([
    prisma.$queryRaw<Array<{ active: bigint | number }>>(Prisma.sql`
      SELECT COUNT(DISTINCT customerId) as active FROM Sale
      WHERE companyId = ${companyId} AND date BETWEEN ${from} AND ${to} AND customerId IS NOT NULL`),
    prisma.$queryRaw<Array<{ c: bigint | number }>>(Prisma.sql`
      SELECT COUNT(*) as c FROM (
        SELECT customerId FROM Sale
        WHERE companyId = ${companyId} AND date BETWEEN ${from} AND ${to} AND customerId IS NOT NULL
        GROUP BY customerId HAVING COUNT(*) > 1)`),
  ]);
  const active = safeParseInt(activeRow[0]?.active);
  const repeat = safeParseInt(repeatRow[0]?.c);
  return {
    totalCustomers: total,
    activeCustomers: active,
    repeatRate: active > 0 ? repeat / active : 0,
  };
}

export async function getRecentSales(companyId: string, limit = 8) {
  return prisma.sale.findMany({
    where: { companyId },
    orderBy: { date: "desc" },
    take: limit,
    select: {
      id: true,
      invoiceNo: true,
      date: true,
      total: true,
      status: true,
      branch: { select: { name: true } },
      customer: { select: { name: true } },
      user: { select: { name: true } },
    },
  });
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
