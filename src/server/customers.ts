import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customer as customerTable } from "@/lib/drizzle/schema";

export async function getCustomers(companyId: string) {
  return db
    .select()
    .from(customerTable)
    .where(eq(customerTable.companyId, companyId))
    .orderBy(customerTable.totalSpent, customerTable.name);
}
