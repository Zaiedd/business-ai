import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiOk, audit, handleZod, requireSession, runApi } from "@/lib/api";
import { getInventory } from "@/server/inventory";
import { productSchema } from "@/lib/validators";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  return runApi(async () => {
    const session = await requireSession(req);
    const [products, company] = await Promise.all([
      getInventory(session.company.id),
      prisma.company.findUnique({ where: { id: session.company.id }, select: { currency: true } }),
    ]);
    return apiOk({ products, currency: company?.currency ?? "USD" });
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
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error, locale);

    const product = await prisma.product.create({
      data: {
        name: parsed.data.name,
        sku: parsed.data.sku ?? null,
        category: parsed.data.category ?? null,
        costPrice: parsed.data.costPrice,
        sellingPrice: parsed.data.sellingPrice,
        stockQty: parsed.data.stockQty,
        lowStockThreshold: parsed.data.lowStockThreshold,
        companyId: session.company.id,
      },
    });

    await audit(session, "INVENTORY.PRODUCT_CREATED", { entity: "Product", entityId: product.id, metadata: { name: product.name }, req });
    return apiOk({ product }, { status: 201 });
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
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error, locale);

    const existing = await prisma.product.findFirst({ where: { id, companyId: session.company.id } });
    if (!existing) return apiError(t("api.productNotFound"), 404);

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: parsed.data.name,
        sku: parsed.data.sku ?? null,
        category: parsed.data.category ?? null,
        costPrice: parsed.data.costPrice,
        sellingPrice: parsed.data.sellingPrice,
        stockQty: parsed.data.stockQty,
        lowStockThreshold: parsed.data.lowStockThreshold,
      },
    });

    await audit(session, "INVENTORY.PRODUCT_UPDATED", { entity: "Product", entityId: id, metadata: { name: product.name }, req });
    return apiOk({ product });
  }, locale);
}

export async function DELETE(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return apiError(t("api.missingId"), 400);

    const product = await prisma.product.findFirst({ where: { id, companyId: session.company.id } });
    if (!product) return apiError(t("api.productNotFound"), 404);

    const saleItems = await prisma.saleItem.count({ where: { productId: id } });
    if (saleItems > 0) return apiError(t("api.productInUse"), 400);

    await prisma.product.delete({ where: { id } });
    await audit(session, "INVENTORY.PRODUCT_DELETED", { entity: "Product", entityId: id, metadata: { name: product.name }, req });
    return apiOk({ success: true });
  }, locale);
}
