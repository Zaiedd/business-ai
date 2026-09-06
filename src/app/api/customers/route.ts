import type { NextRequest } from "next/server";
import { eq, and, count } from "drizzle-orm";
import { db, cuid } from "@/lib/db";
import { customer as customerTable, sale as saleTable, company as companyTable } from "@/lib/drizzle/schema";
import { apiError, apiOk, audit, handleZod, requireSession, runApi } from "@/lib/api";
import { getCustomers } from "@/server/customers";
import { customerSchema } from "@/lib/validators";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  return runApi(async () => {
    const session = await requireSession(req);
    const [customers, company] = await Promise.all([
      getCustomers(session.company.id),
      db.select({ currency: companyTable.currency }).from(companyTable).where(eq(companyTable.id, session.company.id)).limit(1),
    ]);
    return apiOk({ customers, currency: company[0]?.currency ?? "USD" });
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
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error, locale);

    const customerId = cuid();
    await db.insert(customerTable).values({
      id: customerId,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      segment: parsed.data.segment ?? null,
      companyId: session.company.id,
    });

    const [customer] = await db.select().from(customerTable).where(eq(customerTable.id, customerId)).limit(1);
    await audit(session, "CUSTOMERS.CUSTOMER_CREATED", { entity: "Customer", entityId: customerId, metadata: { name: customer!.name }, req });
    return apiOk({ customer }, { status: 201 });
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
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error, locale);

    const [existing] = await db.select({ id: customerTable.id }).from(customerTable).where(and(eq(customerTable.id, id), eq(customerTable.companyId, session.company.id))).limit(1);
    if (!existing) return apiError(t("api.customerNotFound"), 404);

    const [customer] = await db
      .update(customerTable)
      .set({
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        segment: parsed.data.segment ?? null,
      })
      .where(eq(customerTable.id, id))
      .returning();

    await audit(session, "CUSTOMERS.CUSTOMER_UPDATED", { entity: "Customer", entityId: id, metadata: { name: customer!.name }, req });
    return apiOk({ customer });
  }, locale);
}

export async function DELETE(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return apiError(t("api.missingId"), 400);

    const [customer] = await db.select().from(customerTable).where(and(eq(customerTable.id, id), eq(customerTable.companyId, session.company.id))).limit(1);
    if (!customer) return apiError(t("api.customerNotFound"), 404);

    const [salesCount] = await db.select({ c: count() }).from(saleTable).where(eq(saleTable.customerId, id));
    if (Number(salesCount?.c ?? 0) > 0) return apiError(t("api.customerInUse"), 400);

    await db.delete(customerTable).where(eq(customerTable.id, id));
    await audit(session, "CUSTOMERS.CUSTOMER_DELETED", { entity: "Customer", entityId: id, metadata: { name: customer.name }, req });
    return apiOk({ success: true });
  }, locale);
}
