import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { product as productTable } from "@/lib/drizzle/schema";
import { round2 } from "@/lib/utils";

export type StockStatus = "OK" | "LOW" | "OUT";

export function stockStatus(p: { stockQty: number; lowStockThreshold: number }): StockStatus {
  if (p.stockQty <= 0) return "OUT";
  if (p.stockQty <= p.lowStockThreshold) return "LOW";
  return "OK";
}

export async function getInventory(companyId: string) {
  const products = await db
    .select()
    .from(productTable)
    .where(eq(productTable.companyId, companyId))
    .orderBy(productTable.name);
  return products.map((p) => ({
    ...p,
    status: stockStatus(p),
    margin: round2(p.sellingPrice - p.costPrice),
  }));
}
