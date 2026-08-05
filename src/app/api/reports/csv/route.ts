import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
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
    const sales = await prisma.sale.findMany({
      where: { companyId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
      include: { branch: true, user: true, customer: true },
    });
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
    const expenses = await prisma.expense.findMany({
      where: { companyId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
      include: { branch: true },
    });
    return {
      header: [
        t("reports.headers.date"), t("reports.headers.category"), t("reports.headers.description"),
        t("reports.headers.amount"), t("reports.headers.branch"),
      ],
      rows: expenses.map((e) => [toDateKey(e.date), e.category, e.description ?? "", e.amount, e.branch?.name ?? ""]),
    };
  }
  if (type === "products") {
    const products = await prisma.product.findMany({ where: { companyId }, orderBy: { name: "asc" } });
    return {
      header: [
        t("reports.headers.name"), t("reports.headers.sku"), t("reports.headers.category"), t("reports.headers.cost"),
        t("reports.headers.sellingPrice"), t("reports.headers.stock"), t("reports.headers.reorderLevel"),
      ],
      rows: products.map((p) => [p.name, p.sku ?? "", p.category ?? "", p.costPrice, p.sellingPrice, p.stockQty, p.lowStockThreshold]),
    };
  }
  if (type === "customers") {
    const customers = await prisma.customer.findMany({ where: { companyId }, orderBy: { totalSpent: "desc" } });
    return {
      header: [
        t("reports.headers.name"), t("reports.headers.email"), t("reports.headers.phone"), t("reports.headers.segment"),
        t("reports.headers.orders"), t("reports.headers.totalSpent"), t("reports.headers.lastPurchase"),
      ],
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
  const users = await prisma.user.findMany({ where: { companyId }, include: { branch: true } });
  const perf = await prisma.$queryRaw<Array<{ id: string | null; orders: bigint | number; revenue: number }>>`
    SELECT u.id as id, COUNT(s.id) as orders, COALESCE(SUM(s.total), 0) as revenue
    FROM Sale s LEFT JOIN User u ON u.id = s.userId
    WHERE s.companyId = ${companyId} AND s.date BETWEEN ${from} AND ${to} AND s.status = 'COMPLETED'
    GROUP BY u.id`;
  const map = new Map(perf.map((p) => [p.id, p]));
  return {
    header: [
      t("reports.headers.name"), t("reports.headers.email"), t("reports.headers.role"),
      t("reports.headers.branch"), t("reports.headers.orders"), t("reports.headers.revenue"),
    ],
    rows: users.map((u) => {
      const p = map.get(u.id);
      return [u.name, u.email, u.role, u.branch?.name ?? "", Number(p?.orders ?? 0), Number(p?.revenue ?? 0)];
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
