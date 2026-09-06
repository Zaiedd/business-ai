import type { NextRequest } from "next/server";
import { eq, and, count } from "drizzle-orm";
import { db, cuid } from "@/lib/db";
import { product as productTable, saleItem as saleItemTable, company as companyTable } from "@/lib/drizzle/schema";
import { apiError, apiOk, audit, handleZod, requireSession, runApi } from "@/lib/api";
import { getInventory } from "@/server/inventory";
import { productSchema } from "@/lib/validators";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  return runApi(async () => {
    const session = await requireSession(req);
    const [products, company] = await Promise.all([
      getInventory(session.company.id),
      db.select({ currency: companyTable.currency }).from(companyTable).where(eq(companyTable.id, session.company.id)).limit(1),
    ]);
    return apiOk({ products, currency: company[0]?.currency ?? "USD" });
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

    const productId = cuid();
    await db.insert(productTable).values({
      id: productId,
      name: parsed.data.name,
      sku: parsed.data.sku ?? null,
      category: parsed.data.category ?? null,
      costPrice: parsed.data.costPrice,
      sellingPrice: parsed.data.sellingPrice,
      stockQty: parsed.data.stockQty,
      lowStockThreshold: parsed.data.lowStockThreshold,
      companyId: session.company.id,
    });

    const [product] = await db.select().from(productTable).where(eq(productTable.id, productId)).limit(1);
    await audit(session, "INVENTORY.PRODUCT_CREATED", { entity: "Product", entityId: productId, metadata: { name: product!.name }, req });
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

    const [existing] = await db.select({ id: productTable.id }).from(productTable).where(and(eq(productTable.id, id), eq(productTable.companyId, session.company.id))).limit(1);
    if (!existing) return apiError(t("api.productNotFound"), 404);

    const [product] = await db
      .update(productTable)
      .set({
        name: parsed.data.name,
        sku: parsed.data.sku ?? null,
        category: parsed.data.category ?? null,
        costPrice: parsed.data.costPrice,
        sellingPrice: parsed.data.sellingPrice,
        stockQty: parsed.data.stockQty,
        lowStockThreshold: parsed.data.lowStockThreshold,
      })
      .where(eq(productTable.id, id))
      .returning();

    await audit(session, "INVENTORY.PRODUCT_UPDATED", { entity: "Product", entityId: id, metadata: { name: product!.name }, req });
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

    const [product] = await db.select().from(productTable).where(and(eq(productTable.id, id), eq(productTable.companyId, session.company.id))).limit(1);
    if (!product) return apiError(t("api.productNotFound"), 404);

    const [saleItemsCount] = await db.select({ c: count() }).from(saleItemTable).where(eq(saleItemTable.productId, id));
    if (Number(saleItemsCount?.c ?? 0) > 0) return apiError(t("api.productInUse"), 400);

    await db.delete(productTable).where(eq(productTable.id, id));
    await audit(session, "INVENTORY.PRODUCT_DELETED", { entity: "Product", entityId: id, metadata: { name: product.name }, req });
    return apiOk({ success: true });
  }, locale);
}
