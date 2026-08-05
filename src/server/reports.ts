import { prisma } from "@/lib/db";
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
      prisma.sale.aggregate({ where: { companyId, status: "REFUNDED", date: { gte: from, lte: to } }, _sum: { total: true } }),
    ]);
    const sales = await prisma.sale.findMany({
      where: { companyId, date: { gte: from, lte: to } },
      orderBy: { date: "desc" },
      include: { branch: { select: { name: true } }, user: { select: { name: true } }, customer: { select: { name: true } } },
    });
    const refunds = round2(safeParseFloat(refundRow._sum.total));
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
      rows: sales.map((s) => [s.invoiceNo, toDateKey(s.date), s.branch?.name ?? "", s.user?.name ?? "", s.customer?.name ?? "", s.subtotal, s.discount, s.tax, s.total, s.status]),
    };
  }

  if (type === "expenses") {
    const [agg, expenses] = await Promise.all([
      prisma.expense.aggregate({ where: { companyId, date: { gte: from, lte: to } }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.expense.findMany({
        where: { companyId, date: { gte: from, lte: to } },
        orderBy: { date: "desc" },
        include: { branch: { select: { name: true } } },
      }),
    ]);
    return {
      kpis: [
        { key: "totalExpenses", label: t("reports.kpis.totalExpenses"), display: formatMoney(round2(safeParseFloat(agg._sum.amount)), currency) },
        { key: "expenseCount", label: t("reports.kpis.expenseCount"), display: String(agg._count._all) },
      ],
      headers: [
        t("reports.headers.date"), t("reports.headers.category"), t("reports.headers.description"),
        t("reports.headers.amount"), t("reports.headers.branch"),
      ],
      formats: ["date", "text", "text", "currency", "text"],
      rows: expenses.map((e) => [toDateKey(e.date), e.category, e.description ?? "", e.amount, e.branch?.name ?? ""]),
    };
  }

  if (type === "products") {
    const products = await prisma.product.findMany({ where: { companyId }, orderBy: { name: "asc" } });
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
      prisma.customer.findMany({ where: { companyId }, orderBy: { totalSpent: "desc" } }),
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
    const branches = await prisma.branch.findMany({ where: { companyId } });
    const perf = await prisma.$queryRaw<Array<{ id: string | null; orders: bigint | number; revenue: number }>>`
      SELECT b.id as id, COUNT(s.id) as orders, COALESCE(SUM(s.total), 0) as revenue
      FROM Sale s LEFT JOIN Branch b ON b.id = s.branchId
      WHERE s.companyId = ${companyId} AND s.date BETWEEN ${from} AND ${to} AND s.status = 'COMPLETED'
      GROUP BY b.id`;
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

  const users = await prisma.user.findMany({ where: { companyId }, include: { branch: true } });
  const perf = await prisma.$queryRaw<Array<{ id: string | null; orders: bigint | number; revenue: number }>>`
    SELECT u.id as id, COUNT(s.id) as orders, COALESCE(SUM(s.total), 0) as revenue
    FROM Sale s LEFT JOIN User u ON u.id = s.userId
    WHERE s.companyId = ${companyId} AND s.date BETWEEN ${from} AND ${to} AND s.status = 'COMPLETED'
    GROUP BY u.id`;
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
      return [u.name, u.email, u.role, u.branch?.name ?? "", Number(p?.orders ?? 0), Number(p?.revenue ?? 0)];
    }),
  };
}

export type { I18nDict };
