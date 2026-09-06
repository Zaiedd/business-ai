"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, CalendarClock, Printer } from "lucide-react";
import { formatShortDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { HealthReportView, type HealthReportViewData } from "@/components/reports/health-report-view";
import { useI18n } from "@/components/i18n-provider";

interface ViewPayload {
  item: {
    id: string;
    title: string;
    createdAt: string;
    createdByName: string;
  } | null;
  report: HealthReportViewData | null;
}

export default function HistoryDetailPage() {
  const { t, locale } = useI18n();
  const params = useParams();
  const id = String(params.id ?? "");
  const [payload, setPayload] = useState<ViewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/report-history/${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("api.reportNotFound"));
      setPayload(body.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("api.reportNotFound"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <a href="/reports/history" className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            <ArrowLeft className="size-4 rtl:rotate-180" />
          </a>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{payload?.item?.title ?? t("health.title")}</h1>
            {payload?.item && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("history.generated", { date: formatShortDate(payload.item.createdAt, locale) })} · {t("history.savedBy", { name: payload.item.createdByName })}
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="size-3.5" />
          {t("health.print")}
        </Button>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40">
          <CardBody className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300">
              <AlertTriangle className="size-4" /> {error}
            </div>
            <Button variant="danger" size="sm" onClick={load}>{t("common.retry")}</Button>
          </CardBody>
        </Card>
      )}

      {loading && !payload && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <CardSkeleton />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          </div>
          <CardSkeleton />
        </div>
      )}

      {payload?.report && <HealthReportView data={payload.report} />}
    </motion.div>
  );
}