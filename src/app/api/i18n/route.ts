import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiOk, apiError, requireSession, runApi } from "@/lib/api";
import { isLocale } from "@/lib/i18n";
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
    const newLocale = (body as { locale?: unknown } | null)?.locale;
    if (!isLocale(newLocale)) return apiError(t("api.invalidLocale"), 400);

    const session = await requireSession(req);
    await prisma.user.update({ where: { id: session.user.id }, data: { locale: newLocale } });
    return apiOk({ locale: newLocale });
  }, locale);
}
