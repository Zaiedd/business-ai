import { prisma } from "@/lib/db";

export async function getCustomers(companyId: string) {
  return prisma.customer.findMany({
    where: { companyId },
    orderBy: [{ totalSpent: "desc" }, { name: "asc" }],
  });
}
