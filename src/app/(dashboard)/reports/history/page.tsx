"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CalendarClock, Eye, History, RefreshCw, Trash2, UserRound } from "lucide-react";
import { formatShortDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";
import type { ReportHistoryItem } from "@/server/report-history";

function statusBadge(status: string | null, t: (k: string, vars?: Record<string, string>) => string) {
  if (!status) return <Badge variant="neutral">{t("health.status.INSUFFICIENT_DATA")}</Badge>;
  const variant = status === "HEALTHY" ? "success" : status === "NEEDS_ATTENTION" ? "warning" : status === "AT_RISK" ? "warning" : status === "CRITICAL" ? "critical" : "neutral";
  return <Badge variant={variant as "success" | "warning" | "critical" | "neutral"}>{t(`health.status.${status}`)}</Badge>;
}

export default function HistoryPage() {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<ReportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/report-history", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("history.loadFailed"));
      setItems(body.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("history.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("history.deleteConfirm"))) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/report-history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("history.deleteFailed"));
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      window.alert(t("history.deleteFailed"));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t("history.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("history.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} loading={loading}>
          <RefreshCw className="size-3.5" />
          {t("common.refresh")}
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

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/50">
              <History className="size-6 text-indigo-500" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("history.empty")}</p>
            <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">{t("history.emptyHint")}</p>
            <a href="/reports/health" className="mt-1 inline-flex h-8 items-center rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-indigo-500">
              {t("health.title")}
            </a>
          </CardBody>
        </Card>
      )}

      {!loading && items.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardBody className="space-y-3 px-4 py-4">
                <div className="flex items-center justify-between gap-2">
                  {statusBadge(item.headlineStatus, t)}
                  <Badge variant="info">{t("history.periodLabel", { period: t(`health.periodValues.${item.period}`) })}</Badge>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                  {item.headlineScore !== null && (
                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{item.headlineScore}</span>
                  )}
                </div>
                <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <p className="flex items-center gap-1.5">
                    <CalendarClock className="size-3.5" />
                    {t("history.generated", { date: formatShortDate(item.createdAt, locale) })}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <UserRound className="size-3.5" />
                    {t("history.savedBy", { name: item.createdByName })}
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <a href={`/reports/history/${item.id}`} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 text-xs font-medium text-white shadow-sm hover:bg-indigo-500">
                    <Eye className="size-3.5" />
                    {t("history.view")}
                  </a>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(item.id)} loading={deleting === item.id}>
                    <Trash2 className="size-3.5" />
                    {t("history.delete")}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}