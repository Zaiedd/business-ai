import { eq, and, desc, asc, sql, gte, lte, inArray } from "drizzle-orm";
import { db, cuid, dbRunInTransaction, type PreparedStmt } from "@/lib/db";
import { sale, saleItem, product as productTable, branch as branchTable, customer as customerTable, user as userTable, company as companyTable } from "@/lib/drizzle/schema";
import type { SaleStatus } from "@/lib/auth";
import { round2 } from "@/lib/utils";

export class InsufficientStockError extends Error {
  constructor(public productName: string) {
    super(`Insufficient stock for ${productName}`);
  }
}

export class ProductNotFoundError extends Error {
  constructor() {
    super("Product not found");
  }
}

export async function getSales(companyId: string, limit = 200) {
  const sales = await db
    .select({
      id: sale.id,
      invoiceNo: sale.invoiceNo,
      date: sale.date,
      subtotal: sale.subtotal,
      discount: sale.discount,
      tax: sale.tax,
      total: sale.total,
      status: sale.status,
      createdAt: sale.createdAt,
      branch: { id: branchTable.id, name: branchTable.name },
      customer: { id: customerTable.id, name: customerTable.name },
      user: { id: userTable.id, name: userTable.name },
    })
    .from(sale)
    .leftJoin(branchTable, eq(sale.branchId, branchTable.id))
    .leftJoin(customerTable, eq(sale.customerId, customerTable.id))
    .leftJoin(userTable, eq(sale.userId, userTable.id))
    .where(eq(sale.companyId, companyId))
    .orderBy(desc(sale.date))
    .limit(limit);

  // Fetch items for each sale
  const saleIds = sales.map((s) => s.id);
  const items = saleIds.length > 0
    ? await db
        .select({
          id: saleItem.id,
          saleId: saleItem.saleId,
          productId: saleItem.productId,
          qty: saleItem.qty,
          unitPrice: saleItem.unitPrice,
          total: saleItem.total,
          productName: productTable.name,
        })
        .from(saleItem)
        .innerJoin(productTable, eq(saleItem.productId, productTable.id))
        .where(inArray(saleItem.saleId, saleIds))
    : [];

  const itemsBySale = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsBySale.get(item.saleId) || [];
    list.push(item);
    itemsBySale.set(item.saleId, list);
  }

  return sales.map((s) => ({
    ...s,
    items: (itemsBySale.get(s.id) || []).map((i) => ({
      id: i.id,
      productId: i.productId,
      qty: i.qty,
      unitPrice: i.unitPrice,
      total: i.total,
      product: { name: i.productName },
    })),
  }));
}

export async function getSaleRefs(companyId: string) {
  const [branches, customers, products, company] = await Promise.all([
    db.select({ id: branchTable.id, name: branchTable.name }).from(branchTable).where(eq(branchTable.companyId, companyId)).orderBy(asc(branchTable.name)),
    db.select({ id: customerTable.id, name: customerTable.name }).from(customerTable).where(eq(customerTable.companyId, companyId)).orderBy(asc(customerTable.name)),
    db.select({ id: productTable.id, name: productTable.name, sellingPrice: productTable.sellingPrice, stockQty: productTable.stockQty }).from(productTable).where(eq(productTable.companyId, companyId)).orderBy(asc(productTable.name)),
    db.select({ currency: companyTable.currency, taxRate: companyTable.taxRate }).from(companyTable).where(eq(companyTable.id, companyId)).limit(1),
  ]);
  return { branches, customers, products, currency: company[0]?.currency ?? "USD", taxRate: company[0]?.taxRate ?? 0 };
}

export async function nextInvoiceNo(companyId: string, year: number) {
  const prefix = `INV-${year}-`;
  const rows = await db.select({ invoiceNo: sale.invoiceNo }).from(sale).where(eq(sale.companyId, companyId));
  let max = 0;
  for (const s of rows) {
    if (s.invoiceNo.startsWith(prefix)) {
      const n = parseInt(s.invoiceNo.slice(prefix.length), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

async function recomputeCustomerStats(companyId: string, customerId: string) {
  const [agg] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${sale.total}), 0)`,
      count: sql<number>`COUNT(*)`,
      maxDate: sql<Date | null>`MAX(${sale.date})`,
    })
    .from(sale)
    .where(and(eq(sale.companyId, companyId), eq(sale.customerId, customerId), eq(sale.status, "COMPLETED")));

  await db
    .update(customerTable)
    .set({
      totalSpent: round2(Number(agg?.total ?? 0)),
      totalOrders: Number(agg?.count ?? 0),
      lastPurchaseAt: agg?.maxDate ? new Date(agg.maxDate) : null,
    })
    .where(eq(customerTable.id, customerId));
}

export async function createSale(
  companyId: string,
  userId: string,
  data: { branchId: string | null; customerId: string | null; date: Date; discount: number; items: Array<{ productId: string; qty: number; unitPrice: number }> },
) {
  const products = await db
    .select()
    .from(productTable)
    .where(and(eq(productTable.companyId, companyId), inArray(productTable.id, data.items.map((i) => i.productId))));
  const productMap = new Map(products.map((p) => [p.id, p]));
  const stockHits: Array<{ id: string; qty: number }> = [];
  let subtotal = 0;
  const items = data.items.map((i) => {
    const product = productMap.get(i.productId);
    if (!product) throw new ProductNotFoundError();
    if (product.stockQty < i.qty) throw new InsufficientStockError(product.name);
    const total = round2(i.qty * i.unitPrice);
    subtotal = round2(subtotal + total);
    stockHits.push({ id: product.id, qty: i.qty });
    return { productId: i.productId, qty: i.qty, unitPrice: i.unitPrice, costPrice: product.costPrice, total };
  });

  const [company] = await db.select({ taxRate: companyTable.taxRate }).from(companyTable).where(eq(companyTable.id, companyId)).limit(1);
  const invoiceNo = await nextInvoiceNo(companyId, data.date.getFullYear());
  const discount = round2(data.discount);
  const taxable = round2(subtotal - discount);
  const tax = round2((company?.taxRate ?? 0) * taxable);
  const total = round2(taxable + tax);

  const saleId = cuid();
  const stmts: PreparedStmt[] = [
    db.insert(sale).values({
      id: saleId,
      invoiceNo,
      date: data.date,
      subtotal,
      discount,
      tax,
      total,
      status: "COMPLETED",
      companyId,
      branchId: data.branchId,
      userId,
      customerId: data.customerId,
    }).toSQL(),
    ...items.map((item) =>
      db.insert(saleItem).values({
        id: cuid(),
        saleId,
        productId: item.productId,
        qty: item.qty,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice,
        total: item.total,
      }).toSQL(),
    ),
    ...stockHits.map((h) =>
      db.update(productTable).set({ stockQty: sql`${productTable.stockQty} - ${h.qty}` }).where(eq(productTable.id, h.id)).toSQL(),
    ),
  ];
  await dbRunInTransaction(stmts);

  // Return the created sale with relations
  const [created] = await db
    .select({
      id: sale.id,
      invoiceNo: sale.invoiceNo,
      date: sale.date,
      subtotal: sale.subtotal,
      discount: sale.discount,
      tax: sale.tax,
      total: sale.total,
      status: sale.status,
      branch: { id: branchTable.id, name: branchTable.name },
      customer: { id: customerTable.id, name: customerTable.name },
      user: { id: userTable.id, name: userTable.name },
    })
    .from(sale)
    .leftJoin(branchTable, eq(sale.branchId, branchTable.id))
    .leftJoin(customerTable, eq(sale.customerId, customerTable.id))
    .leftJoin(userTable, eq(sale.userId, userTable.id))
    .where(eq(sale.id, saleId))
    .limit(1);

  const saleItems = await db
    .select({
      id: saleItem.id,
      productId: saleItem.productId,
      qty: saleItem.qty,
      unitPrice: saleItem.unitPrice,
      total: saleItem.total,
      productName: productTable.name,
    })
    .from(saleItem)
    .innerJoin(productTable, eq(saleItem.productId, productTable.id))
    .where(eq(saleItem.saleId, saleId));

  if (data.customerId) {
    await recomputeCustomerStats(companyId, data.customerId);
  }

  return {
    ...created,
    items: saleItems.map((i) => ({
      id: i.id,
      productId: i.productId,
      qty: i.qty,
      unitPrice: i.unitPrice,
      total: i.total,
      product: { name: i.productName },
    })),
  };
}

export async function updateSaleStatus(companyId: string, saleId: string, status: SaleStatus) {
  const [saleRow] = await db
    .select()
    .from(sale)
    .where(and(eq(sale.id, saleId), eq(sale.companyId, companyId)))
    .limit(1);
  if (!saleRow) return null;
  if (saleRow.status === status) return saleRow;

  const wasRefunded = saleRow.status === "REFUNDED";
  const nowRefunded = status === "REFUNDED";

  const items = await db.select({ productId: saleItem.productId, qty: saleItem.qty }).from(saleItem).where(eq(saleItem.saleId, saleId));

  const stmts: PreparedStmt[] = [];
  if (nowRefunded && !wasRefunded) {
    for (const item of items) {
      stmts.push(db.update(productTable).set({ stockQty: sql`${productTable.stockQty} + ${item.qty}` }).where(eq(productTable.id, item.productId)).toSQL());
    }
  } else if (!nowRefunded && wasRefunded) {
    for (const item of items) {
      const [product] = await db.select().from(productTable).where(and(eq(productTable.id, item.productId), eq(productTable.companyId, companyId))).limit(1);
      if (!product) throw new ProductNotFoundError();
      if (product.stockQty < item.qty) throw new InsufficientStockError(product.name);
      stmts.push(db.update(productTable).set({ stockQty: sql`${productTable.stockQty} - ${item.qty}` }).where(eq(productTable.id, item.productId)).toSQL());
    }
  }
  stmts.push(db.update(sale).set({ status }).where(eq(sale.id, saleId)).toSQL());
  await dbRunInTransaction(stmts);

  if (saleRow.customerId) {
    await recomputeCustomerStats(companyId, saleRow.customerId);
  }
  return { ...saleRow, status };
}

export async function deleteSale(companyId: string, saleId: string) {
  const [saleRow] = await db
    .select()
    .from(sale)
    .where(and(eq(sale.id, saleId), eq(sale.companyId, companyId)))
    .limit(1);
  if (!saleRow) return null;

  const items = await db.select({ productId: saleItem.productId, qty: saleItem.qty }).from(saleItem).where(eq(saleItem.saleId, saleId));

  await dbRunInTransaction([
    db.delete(saleItem).where(eq(saleItem.saleId, saleId)).toSQL(),
    ...items.map((item) =>
      db.update(productTable).set({ stockQty: sql`${productTable.stockQty} + ${item.qty}` }).where(eq(productTable.id, item.productId)).toSQL(),
    ),
    db.delete(sale).where(eq(sale.id, saleId)).toSQL(),
  ]);

  if (saleRow.customerId) {
    await recomputeCustomerStats(companyId, saleRow.customerId);
  }
  return saleRow;
}
