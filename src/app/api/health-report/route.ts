import type { NextRequest } from "next/server";
import { apiError, apiOk, requireSession, runApi } from "@/lib/api";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";
import { getHealthReport, HEALTH_PERIODS, type HealthPeriod } from "@/server/health";

export async function GET(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    const rawPeriod = req.nextUrl.searchParams.get("period") ?? "30d";
    if (!HEALTH_PERIODS.includes(rawPeriod as HealthPeriod)) {
      return apiError(t("api.invalidRange"), 400);
    }
    const rawDays = req.nextUrl.searchParams.get("days");
    const days = rawDays && Number.isFinite(Number(rawDays)) ? Number(rawDays) : undefined;
    if (rawPeriod === "custom" && (days === undefined || days < 7)) {
      return apiError(t("api.invalidRange"), 400);
    }
    const bundle = await getHealthReport(session.company.id, session.company.name, session.company.currency, locale, rawPeriod as HealthPeriod, days);
    return apiOk(bundle);
  }, locale);
}