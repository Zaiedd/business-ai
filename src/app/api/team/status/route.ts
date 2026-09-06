import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, cuid } from "@/lib/db";
import { user as userTable, company as companyTable } from "@/lib/drizzle/schema";
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

    const [target] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.id, userId)).limit(1);
    if (!target) return apiError(t("api.userNotFound"), 404);

    const [updated] = await db.update(userTable).set({ status }).where(eq(userTable.id, userId)).returning({ id: userTable.id, status: userTable.status });
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
