"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Printer, RefreshCw, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { HealthReportView } from "@/components/reports/health-report-view";
import { useI18n } from "@/components/i18n-provider";
import type { HealthPeriod } from "@/server/health";
import type { HealthReportBundle } from "@/server/health";

const PERIODS: HealthPeriod[] = ["7d", "30d", "90d", "6m", "12m", "custom"];

export default function HealthReportPage() {
  const { t } = useI18n();
  const [data, setData] = useState<HealthReportBundle | null>(null);
  const [period, setPeriod] = useState<HealthPeriod>("30d");
  const [customDays, setCustomDays] = useState("30");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<"saved" | "failed" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const days = useMemo(() => {
    const n = Number(customDays);
    if (!Number.isFinite(n)) return undefined;
    return Math.max(7, Math.min(365, n));
  }, [customDays]);

  const load = useCallback(async (silent = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period });
      if (period === "custom" && days) params.set("days", String(days));
      const res = await fetch(`/api/health-report?${params}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed");
      setData(body.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [period, days]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/report-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, days: period === "custom" ? days : undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed");
      setSaveMsg("saved");
      setTimeout(() => setSaveMsg(null), 3000);
    } catch {
      setSaveMsg("failed");
      setTimeout(() => setSaveMsg(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t("health.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("health.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex items-end gap-1.5">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{t("health.period")}</span>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as HealthPeriod)}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {PERIODS.map((p) => (
                  <option key={p} value={p}>{t(`health.periodValues.${p}`)}</option>
                ))}
              </select>
            </label>
            {period === "custom" && (
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{t("health.customDays")}</span>
                <input
                  type="number"
                  min={7}
                  max={365}
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="h-8 w-20 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => load()} loading={loading}>
            <RefreshCw className="size-3.5" />
            {t("common.refresh")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            {t("health.print")}
          </Button>
          <Button size="sm" onClick={handleSave} loading={saving}>
            {saveMsg === "saved" ? <CheckCircle2 className="size-3.5" /> : saveMsg === "failed" ? <AlertTriangle className="size-3.5" /> : <Save className="size-3.5" />}
            {saveMsg === "saved" ? t("health.saved") : saveMsg === "failed" ? t("health.saveFailed") : t("health.save")}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40">
          <CardBody className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300">
              <AlertTriangle className="size-4" /> {error}
            </div>
            <Button variant="danger" size="sm" onClick={() => load()}>{t("common.retry")}</Button>
          </CardBody>
        </Card>
      )}

      {loading && !data && (
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

      {!loading && data && (
        <div className="space-y-6">
          <div className="no-print">
            {data.headline.score === null && (
              <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
                <CardBody className="flex items-center gap-3 text-sm text-amber-700 dark:text-amber-300">
                  <Sparkles className="size-4 shrink-0" /> {t("health.noData")}
                </CardBody>
              </Card>
            )}
          </div>
          <HealthReportView data={data} />
        </div>
      )}
    </motion.div>
  );
}