import type { NextRequest } from "next/server";
import { apiError, apiOk, requireAdmin, requireSession, runApi, audit } from "@/lib/api";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";
import { HEALTH_PERIODS, type HealthPeriod } from "@/server/health";
import { createHealthReportSnapshot, deleteReportHistoryItem, listReportHistory } from "@/server/report-history";

export async function GET(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    const items = await listReportHistory(session.company.id);
    return apiOk(items);
  }, locale);
}

export async function POST(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(t("api.invalidJson"), 400);
    }
    const { period, days } = (body ?? {}) as { period?: unknown; days?: unknown };
    if (typeof period !== "string" || !HEALTH_PERIODS.includes(period as HealthPeriod)) {
      return apiError(t("api.invalidRange"), 400);
    }
    const parsedDays = days !== undefined && days !== null ? Number(days) : undefined;
    if (period === "custom" && (parsedDays === undefined || !Number.isFinite(parsedDays) || parsedDays < 7)) {
      return apiError(t("api.invalidRange"), 400);
    }
    const created = await createHealthReportSnapshot(session.company.id, session.company.name, session.company.currency, session.user.id, locale, period as HealthPeriod, parsedDays);
    if (!created) return apiError(t("api.unexpected"), 500);
    await audit(session, "REPORT.SAVED", { entity: "AppReport", entityId: created.id, metadata: { period }, req });
    return apiOk(created);
  }, locale);
}

export async function DELETE(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    requireAdmin(session);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return apiError(t("api.missingId"), 400);
    const ok = await deleteReportHistoryItem(id, session.company.id);
    if (!ok) return apiError(t("api.unexpected"), 404);
    await audit(session, "REPORT.DELETED", { entity: "AppReport", entityId: id, req });
    return apiOk({ deleted: true });
  }, locale);
}