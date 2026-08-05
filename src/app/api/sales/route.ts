import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiOk, audit, handleZod, requireSession, runApi } from "@/lib/api";
import { InsufficientStockError, ProductNotFoundError, createSale, deleteSale, getSaleRefs, getSales, updateSaleStatus } from "@/server/sales";
import { saleSchema, saleStatusSchema } from "@/lib/validators";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  return runApi(async () => {
    const session = await requireSession(req);
    const [sales, company] = await Promise.all([
      getSales(session.company.id),
      prisma.company.findUnique({ where: { id: session.company.id }, select: { currency: true, taxRate: true } }),
    ]);
    return apiOk({ sales, currency: company?.currency ?? "USD", taxRate: company?.taxRate ?? 0 });
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
      if (e instanceof InsufficientStockError) return apiError(t("api.stockInsufficient", { name: e.productName }), 400);
      if (e instanceof ProductNotFoundError) return apiError(t("api.productNotFound"), 404);
      throw e;
    }
  }, locale);
}

export async function PATCH(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return apiError(t("api.missingId"), 400);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(t("api.invalidJson"), 400);
    }
    const parsed = saleStatusSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error, locale);

    try {
      const sale = await updateSaleStatus(session.company.id, id, parsed.data.status);
      if (!sale) return apiError(t("api.saleNotFound"), 404);
      await audit(session, "SALES.STATUS_UPDATED", { entity: "Sale", entityId: id, metadata: { status: parsed.data.status }, req });
      return apiOk({ sale });
    } catch (e) {
      if (e instanceof InsufficientStockError) return apiError(t("api.stockInsufficient", { name: e.productName }), 400);
      if (e instanceof ProductNotFoundError) return apiError(t("api.productNotFound"), 404);
      throw e;
    }
  }, locale);
}

export async function DELETE(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return apiError(t("api.missingId"), 400);

    const sale = await deleteSale(session.company.id, id);
    if (!sale) return apiError(t("api.saleNotFound"), 404);
    await audit(session, "SALES.DELETED", { entity: "Sale", entityId: id, metadata: { invoiceNo: sale.invoiceNo }, req });
    return apiOk({ success: true });
  }, locale);
}
