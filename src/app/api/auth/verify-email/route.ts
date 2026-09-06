import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/drizzle/schema";
import { consumeVerificationToken, writeAudit } from "@/lib/auth";
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

    const [updated] = await db.update(userTable).set({ emailVerifiedAt: new Date() }).where(eq(userTable.id, userId)).returning({
      id: userTable.id,
      companyId: userTable.companyId,
      emailVerifiedAt: userTable.emailVerifiedAt,
    });
    await writeAudit({ action: "AUTH.EMAIL_VERIFIED", companyId: updated.companyId, userId: updated.id, req });
    return apiOk({ success: true, user: updated });
  }, locale);
}
