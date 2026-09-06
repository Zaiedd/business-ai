import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/drizzle/schema";
import { consumeVerificationToken, hashPassword, writeAudit } from "@/lib/auth";
import { apiOk, apiError, handleZod, runApi } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validators";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function POST(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(t("api.invalidJson"), 400);
    }
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error, locale);

    const userId = await consumeVerificationToken(parsed.data.token, "PASSWORD_RESET");
    if (!userId) return apiError(t("api.resetLinkInvalid"), 400, "INVALID_TOKEN");

    const [userRow] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);
    if (!userRow) return apiError(t("api.accountNotFound"), 404);

    await db.update(userTable).set({ passwordHash: await hashPassword(parsed.data.password) }).where(eq(userTable.id, userId));
    await writeAudit({ action: "AUTH.PASSWORD_RESET", companyId: userRow.companyId, userId: userRow.id, req });
    return apiOk({ success: true });
  }, locale);
}
