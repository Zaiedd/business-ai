import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/auth";
import { apiError, apiOk, handleZod, requireAdmin, requireSession, runApi } from "@/lib/api";
import { updateRoleSchema } from "@/lib/validators";
import { canManageUsers, ROLE_LABELS } from "@/lib/rbac";
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
    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error, locale);
    const { userId, role } = parsed.data;

    if (userId === session.user.id) {
      return apiError(t("api.cannotChangeOwnRole"), 400);
    }

    const target = await prisma.user.findFirst({ where: { id: userId, companyId: session.company.id } });
    if (!target) return apiError(t("api.userNotFound"), 404);

    if (!canManageUsers(session.user.role, target.role) || !canManageUsers(session.user.role, role)) {
      return apiError(t("api.cannotChangeRole"), 403);
    }

    const updated = await prisma.user.update({ where: { id: userId }, data: { role }, select: { id: true, role: true } });
    await writeAudit({
      action: "TEAM.ROLE_CHANGED",
      companyId: session.company.id,
      userId: session.user.id,
      entity: "User",
      entityId: userId,
      metadata: { from: target.role, to: role, roleLabel: ROLE_LABELS[role] },
      req,
    });

    return apiOk({ user: updated });
  }, locale);
}
