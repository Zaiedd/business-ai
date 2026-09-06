import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { company as companyTable } from "@/lib/drizzle/schema";
import { apiError, apiOk, audit, handleZod, requireSession, runApi } from "@/lib/api";
import { InsufficientStockError, ProductNotFoundError, createSale, deleteSale, getSaleRefs, getSales, updateSaleStatus } from "@/server/sales";
import { saleSchema, saleStatusSchema } from "@/lib/validators";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  return runApi(async () => {
    const session = await requireSession(req);
    const [sales, company] = await Promise.all([
      getSales(session.company.id),
      db.select({ currency: companyTable.currency, taxRate: companyTable.taxRate }).from(companyTable).where(eq(companyTable.id, session.company.id)).limit(1),
    ]);
    return apiOk({ sales, currency: company[0]?.currency ?? "USD", taxRate: company[0]?.taxRate ?? 0 });
  });
}

export async function POST(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(t("api.invalidJson"), 400);
    }
    const parsed = saleSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error, locale);

    const date = parsed.data.date ?? new Date();
    try {
      const sale = await createSale(session.company.id, session.user.id, {
        branchId: parsed.data.branchId || null,
        customerId: parsed.data.customerId || null,
        date,
        discount: parsed.data.discount ?? 0,
        items: parsed.data.items.map((i) => ({ productId: i.productId, qty: i.qty, unitPrice: i.unitPrice })),
      });
      await audit(session, "SALES.CREATED", { entity: "Sale", entityId: sale.id, metadata: { invoiceNo: sale.invoiceNo, total: sale.total }, req });
      return apiOk({ sale }, { status: 201 });
    } catch (e) {
      if (e instanceof InsufficientStockError) return apiError(t("api.insufficientStock", { product: e.productName }), 400, "INSUFFICIENT_STOCK");
      if (e instanceof ProductNotFoundError) return apiError(t("api.productNotFound"), 400, "PRODUCT_NOT_FOUND");
      throw e;
    }
  }, locale);
}

export async function PATCH(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(t("api.invalidJson"), 400);
    }
    const saleId = req.nextUrl.searchParams.get("id");
    if (!saleId) return apiError(t("api.missingId"), 400);
    const parsed = saleStatusSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error, locale);
    const { status } = parsed.data;

    try {
      const updated = await updateSaleStatus(session.company.id, saleId, status);
      if (!updated) return apiError(t("api.saleNotFound"), 404);
      await audit(session, "SALES.STATUS_CHANGED", { entity: "Sale", entityId: saleId, metadata: { status }, req });
      return apiOk({ sale: updated });
    } catch (e) {
      if (e instanceof InsufficientStockError) return apiError(t("api.insufficientStock", { product: e.productName }), 400, "INSUFFICIENT_STOCK");
      if (e instanceof ProductNotFoundError) return apiError(t("api.productNotFound"), 400, "PRODUCT_NOT_FOUND");
      throw e;
    }
  }, locale);
}

export async function DELETE(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    const saleId = req.nextUrl.searchParams.get("id");
    if (!saleId) return apiError(t("api.missingId"), 400);

    const deleted = await deleteSale(session.company.id, saleId);
    if (!deleted) return apiError(t("api.saleNotFound"), 404);
    await audit(session, "SALES.DELETED", { entity: "Sale", entityId: saleId, metadata: { invoiceNo: deleted.invoiceNo }, req });
    return apiOk({ success: true });
  }, locale);
}
