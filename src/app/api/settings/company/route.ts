import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/auth";
import { apiError, apiOk, handleZod, requireAdmin, requireSession, runApi } from "@/lib/api";
import { companySettingsSchema } from "@/lib/validators";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  return runApi(async () => {
    const session = await requireSession(req);
    const company = await prisma.company.findUnique({ where: { id: session.company.id } });
    const stats = {
      users: await prisma.user.count({ where: { companyId: session.company.id } }),
      branches: await prisma.branch.count({ where: { companyId: session.company.id } }),
      products: await prisma.product.count({ where: { companyId: session.company.id } }),
      customers: await prisma.customer.count({ where: { companyId: session.company.id } }),
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

    const updated = await prisma.company.update({
      where: { id: session.company.id },
      data: {
        name: parsed.data.name,
        currency: parsed.data.currency,
        taxRate: parsed.data.taxRate,
        industry: parsed.data.industry ?? null,
      },
      select: { id: true, name: true, currency: true, taxRate: true, industry: true },
    });

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
