import type { NextRequest } from "next/server";
import { eq, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { company as companyTable, user as userTable, branch as branchTable, product as productTable, customer as customerTable } from "@/lib/drizzle/schema";
import { writeAudit } from "@/lib/auth";
import { apiError, apiOk, handleZod, requireAdmin, requireSession, runApi } from "@/lib/api";
import { companySettingsSchema } from "@/lib/validators";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  return runApi(async () => {
    const session = await requireSession(req);
    const [company] = await db.select().from(companyTable).where(eq(companyTable.id, session.company.id)).limit(1);

    const [usersCount] = await db.select({ c: count() }).from(userTable).where(eq(userTable.companyId, session.company.id));
    const [branchesCount] = await db.select({ c: count() }).from(branchTable).where(eq(branchTable.companyId, session.company.id));
    const [productsCount] = await db.select({ c: count() }).from(productTable).where(eq(productTable.companyId, session.company.id));
    const [customersCount] = await db.select({ c: count() }).from(customerTable).where(eq(customerTable.companyId, session.company.id));

    const stats = {
      users: Number(usersCount?.c ?? 0),
      branches: Number(branchesCount?.c ?? 0),
      products: Number(productsCount?.c ?? 0),
      customers: Number(customersCount?.c ?? 0),
    };
    return apiOk({ company, stats });
  });
}

export async function PATCH(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    requireAdmin(session);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(t("api.invalidJson"), 400);
    }
    const parsed = companySettingsSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error, locale);

    const [updated] = await db
      .update(companyTable)
      .set({
        name: parsed.data.name,
        currency: parsed.data.currency,
        taxRate: parsed.data.taxRate,
        industry: parsed.data.industry ?? null,
      })
      .where(eq(companyTable.id, session.company.id))
      .returning({ id: companyTable.id, name: companyTable.name, currency: companyTable.currency, taxRate: companyTable.taxRate, industry: companyTable.industry });

    await writeAudit({
      action: "COMPANY.UPDATED",
      companyId: session.company.id,
      userId: session.user.id,
      entity: "Company",
      entityId: session.company.id,
      req,
    });

    return apiOk({ company: updated });
  }, locale);
}
