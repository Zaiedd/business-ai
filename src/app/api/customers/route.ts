import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiOk, audit, handleZod, requireSession, runApi } from "@/lib/api";
import { getCustomers } from "@/server/customers";
import { customerSchema } from "@/lib/validators";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  return runApi(async () => {
    const session = await requireSession(req);
    const [customers, company] = await Promise.all([
      getCustomers(session.company.id),
      prisma.company.findUnique({ where: { id: session.company.id }, select: { currency: true } }),
    ]);
    return apiOk({ customers, currency: company?.currency ?? "USD" });
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

    const customer = await prisma.customer.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        segment: parsed.data.segment ?? null,
        companyId: session.company.id,
      },
    });

    await audit(session, "CUSTOMERS.CUSTOMER_CREATED", { entity: "Customer", entityId: customer.id, metadata: { name: customer.name }, req });
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

    const existing = await prisma.customer.findFirst({ where: { id, companyId: session.company.id } });
    if (!existing) return apiError(t("api.customerNotFound"), 404);

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        segment: parsed.data.segment ?? null,
      },
    });

    await audit(session, "CUSTOMERS.CUSTOMER_UPDATED", { entity: "Customer", entityId: id, metadata: { name: customer.name }, req });
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

    const customer = await prisma.customer.findFirst({ where: { id, companyId: session.company.id } });
    if (!customer) return apiError(t("api.customerNotFound"), 404);

    const sales = await prisma.sale.count({ where: { customerId: id } });
    if (sales > 0) return apiError(t("api.customerInUse"), 400);

    await prisma.customer.delete({ where: { id } });
    await audit(session, "CUSTOMERS.CUSTOMER_DELETED", { entity: "Customer", entityId: id, metadata: { name: customer.name }, req });
    return apiOk({ success: true });
  }, locale);
}
