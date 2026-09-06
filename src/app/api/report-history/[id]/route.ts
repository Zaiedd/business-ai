import type { NextRequest } from "next/server";
import { apiError, apiOk, requireSession, runApi } from "@/lib/api";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";
import { getReportHistoryItem } from "@/server/report-history";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    const { id } = await params;
    const row = await getReportHistoryItem(id, session.company.id);
    if (!row) return apiError(t("api.reportNotFound"), 404);
    let report = null;
    try {
      report = row.data ? JSON.parse(row.data) : null;
    } catch {
      report = null;
    }
    return apiOk({
      item: {
        id: row.id,
        type: row.type,
        period: row.period,
        customDays: row.customDays,
        title: row.title,
        headlineScore: row.headlineScore,
        headlineStatus: row.headlineStatus,
        summary: row.summary,
        createdAt: row.createdAt,
        createdByName: row.createdByName,
      },
      report,
    });
  }, locale);
}