import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/auth";
import { apiError, apiOk, handleZod, requireAdmin, requireSession, runApi } from "@/lib/api";
import { updateStatusSchema } from "@/lib/validators";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

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
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error, locale);
    const { userId, status } = parsed.data;

    if (userId === session.user.id) {
      return apiError(t("api.cannotDisableSelf"), 400);
    }

    const target = await prisma.user.findFirst({ where: { id: userId, companyId: session.company.id } });
    if (!target) return apiError(t("api.userNotFound"), 404);

    const updated = await prisma.user.update({ where: { id: userId }, data: { status }, select: { id: true, status: true } });
    await writeAudit({
      action: status === "DISABLED" ? "TEAM.USER_DISABLED" : "TEAM.USER_ENABLED",
      companyId: session.company.id,
      userId: session.user.id,
      entity: "User",
      entityId: userId,
      req,
    });

    return apiOk({ user: updated });
  }, locale);
}
