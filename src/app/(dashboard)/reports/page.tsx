"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Download, FileText, History } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";
import { useToast } from "@/components/ui/toast";

const TYPES = ["sales", "expenses", "products", "customers", "branches", "employees"] as const;
const RANGES = ["7d", "30d", "90d", "12m"] as const;
type CellFormat = "text" | "currency" | "number" | "date";

interface Kpi {
  key: string;
  label: string;
  display: string;
}

interface Bundle {
  kpis: Kpi[];
  headers: string[];
  formats: CellFormat[];
  rows: unknown[][];
}

export default function ReportsPage() {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const [type, setType] = useState<(typeof TYPES)[number]>("sales");
  const [range, setRange] = useState<(typeof RANGES)[number]>("30d");
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/overview?type=${type}&range=${range}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("reports.loadFailed"));
      setBundle(body.data);
      setCurrency(body.data.currency ?? "USD");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("reports.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [type, range, t]);

  useEffect(() => {
    load();
  }, [load]);

  function renderCell(format: CellFormat, value: unknown, index: number) {
    if (value === null || value === "") return "—";
    if (format === "currency") return formatCurrency(Number(value), currency, false, locale);
    if (format === "number") return formatNumber(Number(value), 0, locale);
    if (format === "date") return String(value);
    if (index === 0) return <span className="font-medium text-slate-900 dark:text-slate-100">{String(value)}</span>;
    return String(value);
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await fetch(`/api/reports/csv?type=${type}&range=${range}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast(body.error ?? "Export failed", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-${range}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast("Export failed", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t("reports.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("reports.subtitle")}</p>
        </div>
        <Button onClick={exportCsv} loading={exporting}>
          <Download className="size-4" />
          {t("reports.exportCsv")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <a href="/reports/health" className="group">
          <Card className="transition-shadow hover:shadow-md">
            <CardBody className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <FileText className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("reports.hub.healthTitle")}</p>
                  <p className="mt-0.5 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t("reports.hub.healthDesc")}</p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 group-hover:underline dark:text-indigo-400">
                    {t("reports.hub.open")} <ArrowRight className="size-3 rtl:rotate-180" />
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </a>

        <a href="/reports/history" className="group">
          <Card className="transition-shadow hover:shadow-md">
            <CardBody className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white dark:bg-slate-700">
                  <History className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("reports.hub.historyTitle")}</p>
                  <p className="mt-0.5 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t("reports.hub.historyDesc")}</p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 group-hover:underline dark:text-indigo-400">
                    {t("reports.hub.open")} <ArrowRight className="size-3 rtl:rotate-180" />
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          label={t("reports.type")}
          className="w-48"
          options={TYPES.map((ty) => ({ value: ty, label: t(`reports.types.${ty}` as never) }))}
          value={type}
          onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
        />
        <Select
          label={t("reports.range")}
          className="w-40"
          options={RANGES.map((r) => ({ value: r, label: t(`dashboard.lastRange.${r}` as never) }))}
          value={range}
          onChange={(e) => setRange(e.target.value as (typeof RANGES)[number])}
        />
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40">
          <CardBody className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300">
            <AlertCircle className="size-4" />
            {error}
            <Button variant="danger" size="sm" className="ms-auto" onClick={load}>{t("common.retry")}</Button>
          </CardBody>
        </Card>
      )}

      {loading || !bundle ? (
        <div className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
          <CardSkeleton />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {bundle.kpis.map((k) => (
              <Card key={k.key}>
                <CardBody className="text-center">
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{k.display}</p>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{k.label}</p>
                </CardBody>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader
              title={t("reports.preview")}
              subtitle={bundle.rows.length === 1 ? t("reports.rows", { count: String(bundle.rows.length) }) : t("reports.rows", { count: String(bundle.rows.length) })}
            />
            <CardBody className="-mx-5 overflow-x-auto px-5">
              {bundle.rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{t("reports.empty")}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-start text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
                      {bundle.headers.map((h, i) => (
                        <th key={i} className="py-2 pe-4 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {bundle.rows.slice(0, 100).map((row, r) => (
                      <tr key={r} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        {row.map((cell, c) => (
                          <td key={c} className="py-3 pe-4 text-slate-600 dark:text-slate-400">
                            {renderCell(bundle.formats[c] ?? "text", cell, c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
