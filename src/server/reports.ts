import { eq, and, desc, sql, gte, lte, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { sale, saleItem, expense as expenseTable, product as productTable, customer as customerTable, branch as branchTable, user as userTable } from "@/lib/drizzle/schema";
import { getPeriodTotals, getCustomerStats, rangeToBounds } from "@/server/analytics";
import { round2, safeParseFloat, safeParseInt, toDateKey } from "@/lib/utils";
import type { DateRange } from "@/lib/validators";
import type { I18nDict } from "@/lib/i18n/server";

export const REPORT_TYPES = ["sales", "expenses", "products", "customers", "branches", "employees"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

type T = (path: string, params?: Record<string, string | number>) => string;
export type CellFormat = "text" | "currency" | "number" | "date";

export interface ReportBundle {
  kpis: Array<{ key: string; label: string; display: string }>;
  headers: string[];
  formats: CellFormat[];
  rows: unknown[][];
}

function formatMoney(v: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(round2(v));
}

export async function getReportBundle(companyId: string, currency: string, type: ReportType, range: DateRange, t: T): Promise<ReportBundle> {
  const { from, to } = rangeToBounds(range);

  if (type === "sales") {
    const [totals, refundRow] = await Promise.all([
      getPeriodTotals(companyId, from, to),
      db
        .select({ total: sql<number>`COALESCE(SUM(${sale.total}), 0)` })
        .from(sale)
        .where(and(eq(sale.companyId, companyId), eq(sale.status, "REFUNDED"), gte(sale.date, from), lte(sale.date, to))),
    ]);
    const sales = await db
      .select({
        invoiceNo: sale.invoiceNo,
        date: sale.date,
        subtotal: sale.subtotal,
        discount: sale.discount,
        tax: sale.tax,
        total: sale.total,
        status: sale.status,
        branchName: branchTable.name,
        userName: userTable.name,
        customerName: customerTable.name,
      })
      .from(sale)
      .leftJoin(branchTable, eq(sale.branchId, branchTable.id))
      .leftJoin(userTable, eq(sale.userId, userTable.id))
      .leftJoin(customerTable, eq(sale.customerId, customerTable.id))
      .where(and(eq(sale.companyId, companyId), gte(sale.date, from), lte(sale.date, to)))
      .orderBy(desc(sale.date));

    const refunds = round2(safeParseFloat(refundRow[0]?.total));
    return {
      kpis: [
        { key: "revenue", label: t("reports.kpis.revenue"), display: formatMoney(totals.revenue, currency) },
        { key: "orders", label: t("reports.kpis.orders"), display: String(totals.orders) },
        { key: "avgOrderValue", label: t("reports.kpis.avgOrderValue"), display: formatMoney(totals.avgOrderValue, currency) },
        { key: "refunds", label: t("reports.kpis.refunds"), display: formatMoney(refunds, currency) },
      ],
      headers: [
        t("reports.headers.invoice"), t("reports.headers.date"), t("reports.headers.branch"), t("reports.headers.employee"),
        t("reports.headers.customer"), t("reports.headers.subtotal"), t("reports.headers.discount"), t("reports.headers.tax"),
        t("reports.headers.total"), t("reports.headers.status"),
      ],
      formats: ["text", "date", "text", "text", "text", "currency", "currency", "currency", "currency", "text"],
      rows: sales.map((s) => [s.invoiceNo, toDateKey(s.date), s.branchName ?? "", s.userName ?? "", s.customerName ?? "", s.subtotal, s.discount, s.tax, s.total, s.status]),
    };
  }

  if (type === "expenses") {
    const [agg, expenses] = await Promise.all([
      db
        .select({ amount: sql<number>`COALESCE(SUM(${expenseTable.amount}), 0)`, cnt: sql<number>`COUNT(*)::int` })
        .from(expenseTable)
        .where(and(eq(expenseTable.companyId, companyId), gte(expenseTable.date, from), lte(expenseTable.date, to))),
      db
        .select({
          date: expenseTable.date,
          category: expenseTable.category,
          description: expenseTable.description,
          amount: expenseTable.amount,
          branchName: branchTable.name,
        })
        .from(expenseTable)
        .leftJoin(branchTable, eq(expenseTable.branchId, branchTable.id))
        .where(and(eq(expenseTable.companyId, companyId), gte(expenseTable.date, from), lte(expenseTable.date, to)))
        .orderBy(desc(expenseTable.date)),
    ]);
    return {
      kpis: [
        { key: "totalExpenses", label: t("reports.kpis.totalExpenses"), display: formatMoney(round2(safeParseFloat(agg[0]?.amount)), currency) },
        { key: "expenseCount", label: t("reports.kpis.expenseCount"), display: String(agg[0]?.cnt ?? 0) },
      ],
      headers: [
        t("reports.headers.date"), t("reports.headers.category"), t("reports.headers.description"),
        t("reports.headers.amount"), t("reports.headers.branch"),
      ],
      formats: ["date", "text", "text", "currency", "text"],
      rows: expenses.map((e) => [toDateKey(e.date), e.category, e.description ?? "", e.amount, e.branchName ?? ""]),
    };
  }

  if (type === "products") {
    const products = await db.select().from(productTable).where(eq(productTable.companyId, companyId)).orderBy(productTable.name);
    const stockValue = round2(products.reduce((sum, p) => sum + p.stockQty * p.costPrice, 0));
    const lowStock = products.filter((p) => p.stockQty <= p.lowStockThreshold).length;
    return {
      kpis: [
        { key: "productCount", label: t("reports.kpis.productCount"), display: String(products.length) },
        { key: "stockValue", label: t("reports.kpis.stockValue"), display: formatMoney(stockValue, currency) },
        { key: "lowStock", label: t("reports.kpis.lowStock"), display: String(lowStock) },
      ],
      headers: [
        t("reports.headers.name"), t("reports.headers.sku"), t("reports.headers.category"), t("reports.headers.cost"),
        t("reports.headers.sellingPrice"), t("reports.headers.stock"), t("reports.headers.reorderLevel"),
      ],
      formats: ["text", "text", "text", "currency", "currency", "number", "number"],
      rows: products.map((p) => [p.name, p.sku ?? "", p.category ?? "", p.costPrice, p.sellingPrice, p.stockQty, p.lowStockThreshold]),
    };
  }

  if (type === "customers") {
    const [customers, stats] = await Promise.all([
      db.select().from(customerTable).where(eq(customerTable.companyId, companyId)).orderBy(desc(customerTable.totalSpent)),
      getCustomerStats(companyId, from, to),
    ]);
    const totalSpent = round2(customers.reduce((sum, c) => sum + c.totalSpent, 0));
    return {
      kpis: [
        { key: "customerCount", label: t("reports.kpis.customerCount"), display: String(customers.length) },
        { key: "totalSpent", label: t("reports.kpis.totalSpent"), display: formatMoney(totalSpent, currency) },
        { key: "repeatRate", label: t("reports.kpis.repeatRate"), display: `${(stats.repeatRate * 100).toFixed(1)}%` },
      ],
      headers: [
        t("reports.headers.name"), t("reports.headers.email"), t("reports.headers.phone"), t("reports.headers.segment"),
        t("reports.headers.orders"), t("reports.headers.totalSpent"), t("reports.headers.lastPurchase"),
      ],
      formats: ["text", "text", "text", "text", "number", "currency", "date"],
      rows: customers.map((c) => [c.name, c.email ?? "", c.phone ?? "", c.segment ?? "", c.totalOrders, c.totalSpent, toDateKey(c.lastPurchaseAt)]),
    };
  }

  if (type === "branches") {
    const branches = await db.select().from(branchTable).where(eq(branchTable.companyId, companyId));
    const perf = await db
      .select({
        id: branchTable.id,
        orders: sql<number>`COUNT(${sale.id})`,
        revenue: sql<number>`COALESCE(SUM(${sale.total}), 0)`,
      })
      .from(sale)
      .leftJoin(branchTable, eq(branchTable.id, sale.branchId))
      .where(and(eq(sale.companyId, companyId), gte(sale.date, from), lte(sale.date, to), eq(sale.status, "COMPLETED")))
      .groupBy(branchTable.id);

    const map = new Map(perf.map((p) => [p.id, p]));
    const totalRevenue = round2(perf.reduce((sum, p) => sum + safeParseFloat(p.revenue), 0));
    return {
      kpis: [
        { key: "branchCount", label: t("reports.kpis.branchCount"), display: String(branches.length) },
        { key: "revenue", label: t("reports.kpis.revenue"), display: formatMoney(totalRevenue, currency) },
      ],
      headers: [
        t("reports.headers.name"), t("reports.headers.city"), t("reports.headers.address"),
        t("reports.headers.orders"), t("reports.headers.revenue"),
      ],
      formats: ["text", "text", "text", "number", "currency"],
      rows: branches.map((b) => {
        const p = map.get(b.id);
        return [b.name, b.city ?? "", b.address ?? "", Number(p?.orders ?? 0), Number(p?.revenue ?? 0)];
      }),
    };
  }

  // employees
  const users = await db.select().from(userTable).where(eq(userTable.companyId, companyId));
  const perf = await db
    .select({
      id: userTable.id,
      orders: sql<number>`COUNT(${sale.id})`,
      revenue: sql<number>`COALESCE(SUM(${sale.total}), 0)`,
    })
    .from(sale)
    .leftJoin(userTable, eq(userTable.id, sale.userId))
    .where(and(eq(sale.companyId, companyId), gte(sale.date, from), lte(sale.date, to), eq(sale.status, "COMPLETED")))
    .groupBy(userTable.id);

  const map = new Map(perf.map((p) => [p.id, p]));
  const totalRevenue = round2(perf.reduce((sum, p) => sum + safeParseFloat(p.revenue), 0));
  return {
    kpis: [
      { key: "employeeCount", label: t("reports.kpis.employeeCount"), display: String(users.length) },
      { key: "revenue", label: t("reports.kpis.revenue"), display: formatMoney(totalRevenue, currency) },
    ],
    headers: [
      t("reports.headers.name"), t("reports.headers.email"), t("reports.headers.role"),
      t("reports.headers.branch"), t("reports.headers.orders"), t("reports.headers.revenue"),
    ],
    formats: ["text", "text", "text", "text", "number", "currency"],
    rows: users.map((u) => {
      const p = map.get(u.id);
      return [u.name, u.email, u.role, "", Number(p?.orders ?? 0), Number(p?.revenue ?? 0)];
    }),
  };
}

export type { I18nDict };
