import type { NextRequest } from "next/server";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { sale, expense as expenseTable, product as productTable, customer as customerTable, branch as branchTable, user as userTable } from "@/lib/drizzle/schema";
import { escapeCsv, apiError, requireSession, runApi } from "@/lib/api";
import { rangeToBounds } from "@/server/analytics";
import { toDateKey } from "@/lib/utils";
import { DATE_RANGES, type DateRange } from "@/lib/validators";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

const TYPES = ["sales", "expenses", "products", "customers", "branches", "employees"] as const;
type ReportType = (typeof TYPES)[number];

type T = ReturnType<typeof serverT>;

async function buildRows(type: ReportType, companyId: string, from: Date, to: Date, t: T): Promise<{ header: string[]; rows: unknown[][] }> {
  if (type === "sales") {
    const sales = await db
      .select({
        invoiceNo: sale.invoiceNo,
        date: sale.date,
        subtotal: sale.subtotal,
        discount: sale.discount,
        tax: sale.tax,
        total: sale.total,
        status: sale.status,
        branch: branchTable,
        user: userTable,
        customer: customerTable,
      })
      .from(sale)
      .leftJoin(branchTable, eq(sale.branchId, branchTable.id))
      .leftJoin(userTable, eq(sale.userId, userTable.id))
      .leftJoin(customerTable, eq(sale.customerId, customerTable.id))
      .where(and(eq(sale.companyId, companyId), gte(sale.date, from), lte(sale.date, to)))
      .orderBy(sale.date);
    return {
      header: [
        t("reports.headers.invoice"), t("reports.headers.date"), t("reports.headers.branch"), t("reports.headers.employee"),
        t("reports.headers.customer"), t("reports.headers.subtotal"), t("reports.headers.discount"), t("reports.headers.tax"),
        t("reports.headers.total"), t("reports.headers.status"),
      ],
      rows: sales.map((s) => [s.invoiceNo, toDateKey(s.date), s.branch?.name ?? "", s.user?.name ?? "", s.customer?.name ?? "", s.subtotal, s.discount, s.tax, s.total, s.status]),
    };
  }
  if (type === "expenses") {
    const expenses = await db
      .select({
        date: expenseTable.date,
        category: expenseTable.category,
        description: expenseTable.description,
        amount: expenseTable.amount,
        branch: branchTable,
      })
      .from(expenseTable)
      .leftJoin(branchTable, eq(expenseTable.branchId, branchTable.id))
      .where(and(eq(expenseTable.companyId, companyId), gte(expenseTable.date, from), lte(expenseTable.date, to)))
      .orderBy(expenseTable.date);
    return {
      header: [
        t("reports.headers.date"), t("reports.headers.category"), t("reports.headers.description"),
        t("reports.headers.amount"), t("reports.headers.branch"),
      ],
      rows: expenses.map((e) => [toDateKey(e.date), e.category, e.description ?? "", e.amount, e.branch?.name ?? ""]),
    };
  }
  if (type === "products") {
    const products = await db.select().from(productTable).where(eq(productTable.companyId, companyId)).orderBy(productTable.name);
    return {
      header: [
        t("reports.headers.name"), t("reports.headers.sku"), t("reports.headers.category"), t("reports.headers.cost"),
        t("reports.headers.sellingPrice"), t("reports.headers.stock"), t("reports.headers.reorderLevel"),
      ],
      rows: products.map((p) => [p.name, p.sku ?? "", p.category ?? "", p.costPrice, p.sellingPrice, p.stockQty, p.lowStockThreshold]),
    };
  }
  if (type === "customers") {
    const customers = await db.select().from(customerTable).where(eq(customerTable.companyId, companyId)).orderBy(desc(customerTable.totalSpent));
    return {
      header: [
        t("reports.headers.name"), t("reports.headers.email"), t("reports.headers.phone"), t("reports.headers.segment"),
        t("reports.headers.orders"), t("reports.headers.totalSpent"), t("reports.headers.lastPurchase"),
      ],
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
    return {
      header: [
        t("reports.headers.name"), t("reports.headers.city"), t("reports.headers.address"),
        t("reports.headers.orders"), t("reports.headers.revenue"),
      ],
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
  return {
    header: [
      t("reports.headers.name"), t("reports.headers.email"), t("reports.headers.role"),
      t("reports.headers.branch"), t("reports.headers.orders"), t("reports.headers.revenue"),
    ],
    rows: users.map((u) => {
      const p = map.get(u.id);
      return [u.name, u.email, u.role, "", Number(p?.orders ?? 0), Number(p?.revenue ?? 0)];
    }),
  };
}

export async function GET(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    const type = (req.nextUrl.searchParams.get("type") ?? "sales") as ReportType;
    const rawRange = req.nextUrl.searchParams.get("range") ?? "30d";
    if (!TYPES.includes(type)) return apiError(t("api.invalidReportType"), 400);
    if (!DATE_RANGES.includes(rawRange as DateRange)) return apiError(t("api.invalidRange"), 400);

    const { from, to } = rangeToBounds(rawRange as DateRange);
    const { header, rows } = await buildRows(type, session.company.id, from, to, t);

    const csv = [header.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\r\n");

    const dateStamp = to.toISOString().slice(0, 10);
    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="business-ai-${type}-${dateStamp}.csv"`,
      },
    });
  }, locale);
}
