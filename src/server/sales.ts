import type { SaleStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
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
  return prisma.sale.findMany({
    where: { companyId },
    orderBy: { date: "desc" },
    take: limit,
    include: {
      branch: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          productId: true,
          qty: true,
          unitPrice: true,
          total: true,
          product: { select: { name: true } },
        },
      },
    },
  });
}

export async function getSaleRefs(companyId: string) {
  const [branches, customers, products, company] = await Promise.all([
    prisma.branch.findMany({ where: { companyId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { companyId }, orderBy: { name: "asc" }, select: { id: true, name: true, sellingPrice: true, stockQty: true } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { currency: true, taxRate: true } }),
  ]);
  return { branches, customers, products, currency: company?.currency ?? "USD", taxRate: company?.taxRate ?? 0 };
}

export async function nextInvoiceNo(companyId: string, year: number) {
  const prefix = `INV-${year}-`;
  const sales = await prisma.sale.findMany({ where: { companyId }, select: { invoiceNo: true } });
  let max = 0;
  for (const s of sales) {
    if (s.invoiceNo.startsWith(prefix)) {
      const n = parseInt(s.invoiceNo.slice(prefix.length), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

async function recomputeCustomerStats(companyId: string, customerId: string) {
  const agg = await prisma.sale.aggregate({
    where: { companyId, customerId, status: "COMPLETED" },
    _sum: { total: true },
    _count: { _all: true },
    _max: { date: true },
  });
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      totalSpent: round2(agg._sum.total ?? 0),
      totalOrders: agg._count._all,
      lastPurchaseAt: agg._max.date,
    },
  });
}

const saleInclude = {
  branch: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      productId: true,
      qty: true,
      unitPrice: true,
      total: true,
      product: { select: { name: true } },
    },
  },
} as const;

export async function createSale(
  companyId: string,
  userId: string,
  data: { branchId: string | null; customerId: string | null; date: Date; discount: number; items: Array<{ productId: string; qty: number; unitPrice: number }> },
) {
  const products = await prisma.product.findMany({ where: { companyId, id: { in: data.items.map((i) => i.productId) } } });
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

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { taxRate: true } });
  const invoiceNo = await nextInvoiceNo(companyId, data.date.getFullYear());
  const discount = round2(data.discount);
  const taxable = round2(subtotal - discount);
  const tax = round2((company?.taxRate ?? 0) * taxable);
  const total = round2(taxable + tax);

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: {
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
        items: { create: items },
      },
      include: saleInclude,
    });
    for (const h of stockHits) {
      await tx.product.update({ where: { id: h.id }, data: { stockQty: { decrement: h.qty } } });
    }
    return created;
  });

  if (data.customerId) {
    await recomputeCustomerStats(companyId, data.customerId);
  }
  return sale;
}

export async function updateSaleStatus(companyId: string, saleId: string, status: SaleStatus) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, companyId },
    include: { items: { select: { productId: true, qty: true } } },
  });
  if (!sale) return null;
  if (sale.status === status) return sale;

  const wasRefunded = sale.status === "REFUNDED";
  const nowRefunded = status === "REFUNDED";

  const updated = await prisma.$transaction(async (tx) => {
    if (nowRefunded && !wasRefunded) {
      for (const item of sale.items) {
        await tx.product.update({ where: { id: item.productId }, data: { stockQty: { increment: item.qty } } });
      }
    } else if (!nowRefunded && wasRefunded) {
      for (const item of sale.items) {
        const product = await tx.product.findFirst({ where: { id: item.productId, companyId } });
        if (!product) throw new ProductNotFoundError();
        if (product.stockQty < item.qty) throw new InsufficientStockError(product.name);
        await tx.product.update({ where: { id: item.productId }, data: { stockQty: { decrement: item.qty } } });
      }
    }
    return tx.sale.update({ where: { id: saleId }, data: { status } });
  });

  if (sale.customerId) {
    await recomputeCustomerStats(companyId, sale.customerId);
  }
  return updated;
}

export async function deleteSale(companyId: string, saleId: string) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, companyId },
    include: { items: { select: { productId: true, qty: true } } },
  });
  if (!sale) return null;

  await prisma.$transaction(async (tx) => {
    await tx.sale.delete({ where: { id: saleId } });
    for (const item of sale.items) {
      await tx.product.update({ where: { id: item.productId }, data: { stockQty: { increment: item.qty } } });
    }
  });

  if (sale.customerId) {
    await recomputeCustomerStats(companyId, sale.customerId);
  }
  return sale;
}
