import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/drizzle/schema";
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
    await db.update(userTable).set({ locale: newLocale }).where(eq(userTable.id, session.user.id));
    return apiOk({ locale: newLocale });
  }, locale);
}
