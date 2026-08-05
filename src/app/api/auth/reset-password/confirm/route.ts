import type { NextRequest } from "next/server";
import { consumeVerificationToken, hashPassword, writeAudit } from "@/lib/auth";
import { prisma } from "@/lib/db";
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

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return apiError(t("api.accountNotFound"), 404);

    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(parsed.data.password) } });
    await writeAudit({ action: "AUTH.PASSWORD_RESET", companyId: user.companyId, userId: user.id, req });
    return apiOk({ success: true });
  }, locale);
}
