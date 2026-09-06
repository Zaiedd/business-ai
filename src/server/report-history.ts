import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appReport, user as userTable } from "@/lib/drizzle/schema";
import type { Locale } from "@/lib/i18n";
import { serverT } from "@/lib/i18n/server";
import { getHealthReport, type HealthPeriod } from "@/server/health";
import { formatDate } from "@/lib/utils";

export interface ReportHistoryItem {
  id: string;
  type: string;
  period: string;
  customDays: number | null;
  title: string;
  headlineScore: number | null;
  headlineStatus: string | null;
  summary: string | null;
  createdAt: Date;
  createdByName: string;
}

export async function listReportHistory(companyId: string, limit = 50): Promise<ReportHistoryItem[]> {
  const rows = await db
    .select({
      id: appReport.id,
      type: appReport.type,
      period: appReport.period,
      customDays: appReport.customDays,
      title: appReport.title,
      headlineScore: appReport.headlineScore,
      headlineStatus: appReport.headlineStatus,
      summary: appReport.summary,
      createdAt: appReport.createdAt,
      createdByName: userTable.name,
    })
    .from(appReport)
    .leftJoin(userTable, eq(appReport.createdById, userTable.id))
    .where(eq(appReport.companyId, companyId))
    .orderBy(desc(appReport.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    type: String(r.type ?? "health"),
    period: String(r.period ?? "30d"),
    customDays: r.customDays,
    title: String(r.title ?? "Report"),
    headlineScore: r.headlineScore,
    headlineStatus: r.headlineStatus,
    summary: r.summary,
    createdAt: r.createdAt,
    createdByName: String(r.createdByName ?? "—"),
  }));
}

export async function getReportHistoryItem(id: string, companyId: string) {
  const rows = await db
    .select({
      id: appReport.id,
      type: appReport.type,
      period: appReport.period,
      customDays: appReport.customDays,
      title: appReport.title,
      headlineScore: appReport.headlineScore,
      headlineStatus: appReport.headlineStatus,
      summary: appReport.summary,
      data: appReport.data,
      createdAt: appReport.createdAt,
      createdByName: userTable.name,
      companyId: appReport.companyId,
    })
    .from(appReport)
    .leftJoin(userTable, eq(appReport.createdById, userTable.id))
    .where(eq(appReport.id, id));
  const row = rows[0];
  if (!row || row.companyId !== companyId) return null;
  return row;
}

/** Compute a health snapshot for the current premium period and persist it. */
export async function createHealthReportSnapshot(
  companyId: string,
  companyName: string,
  currency: string,
  userId: string,
  locale: Locale,
  period: HealthPeriod,
  customDays?: number,
) {
  const t = serverT(locale);
  const bundle = await getHealthReport(companyId, companyName, currency, locale, period, customDays);
  if (!bundle) return null;

  const snapshot = {
    meta: bundle.meta,
    headline: bundle.headline,
    areas: bundle.areas,
    kpis: bundle.kpis,
    diagnosis: bundle.diagnosis,
    risks: bundle.risks,
    opportunities: bundle.opportunities,
    actionPlan: bundle.actionPlan,
    topProducts: bundle.topProducts,
    topBranches: bundle.topBranches,
    inventory: bundle.inventory,
    atRiskCustomers: bundle.atRiskCustomers,
  };

  const [row] = await db
    .insert(appReport)
    .values({
      id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      type: "health",
      period,
      customDays: period === "custom" ? customDays ?? null : null,
      title: t("health.title"),
      headlineScore: bundle.headline.score,
      headlineStatus: bundle.headline.status,
      summary: bundle.headline.summary,
      data: JSON.stringify(snapshot),
      companyId,
      createdById: userId,
    })
    .returning({ id: appReport.id, createdAt: appReport.createdAt });

  return row ?? null;
}

export async function deleteReportHistoryItem(id: string, companyId: string): Promise<boolean> {
  const result = await db.delete(appReport).where(eq(appReport.id, id)).returning({ id: appReport.id });
  return result.length > 0;
}