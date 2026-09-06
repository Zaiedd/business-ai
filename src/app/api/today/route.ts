import type { NextRequest } from "next/server";
import { apiError, apiOk, requireSession, runApi } from "@/lib/api";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";
import { getTodayBundle } from "@/server/today";

export async function GET(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    const bundle = await getTodayBundle(session.company.id, session.company.name, session.company.currency, locale);
    return apiOk(bundle);
  }, locale);
}