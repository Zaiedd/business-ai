import type { NextRequest } from "next/server";
import { apiError, apiOk, requireSession, runApi } from "@/lib/api";
import { REPORT_TYPES, getReportBundle, type ReportType } from "@/server/reports";
import { DATE_RANGES, type DateRange } from "@/lib/validators";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    const rawType = req.nextUrl.searchParams.get("type") ?? "sales";
    const rawRange = req.nextUrl.searchParams.get("range") ?? "30d";
    if (!REPORT_TYPES.includes(rawType as ReportType)) return apiError(t("api.invalidReportType"), 400);
    if (!DATE_RANGES.includes(rawRange as DateRange)) return apiError(t("api.invalidRange"), 400);

    const bundle = await getReportBundle(session.company.id, session.company.currency, rawType as ReportType, rawRange as DateRange, t);
    return apiOk({ ...bundle, currency: session.company.currency });
  }, locale);
}
