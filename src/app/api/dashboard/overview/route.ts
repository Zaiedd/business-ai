import type { NextRequest } from "next/server";
import { getDashboardBundle } from "@/server/dashboard";
import { apiError, apiOk, requireSession, runApi } from "@/lib/api";
import { DATE_RANGES, type DateRange } from "@/lib/validators";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    const rawRange = req.nextUrl.searchParams.get("range") ?? "30d";
    if (!DATE_RANGES.includes(rawRange as DateRange)) {
      return apiError(t("api.invalidRange"), 400);
    }
    const bundle = await getDashboardBundle(session.company.id, rawRange as DateRange, session.company.currency, locale);
    return apiOk({ ...bundle, role: session.user.role });
  }, locale);
}
