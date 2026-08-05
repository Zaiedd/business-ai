import type { NextRequest } from "next/server";
import { consumeVerificationToken, writeAudit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiOk, apiError, runApi } from "@/lib/api";
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
    const token = (body as { token?: string } | null)?.token;
    if (!token || typeof token !== "string") return apiError(t("api.missingToken"), 400);

    const userId = await consumeVerificationToken(token, "EMAIL_VERIFY");
    if (!userId) return apiError(t("api.verifyLinkInvalid"), 400, "INVALID_TOKEN");

    const user = await prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
      select: { id: true, companyId: true, emailVerifiedAt: true },
    });
    await writeAudit({ action: "AUTH.EMAIL_VERIFIED", companyId: user.companyId, userId: user.id, req });
    return apiOk({ success: true, user });
  }, locale);
}
